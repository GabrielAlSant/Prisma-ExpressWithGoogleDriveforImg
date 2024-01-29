import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { google } from 'googleapis';
import stream from 'stream';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt'
import jwt, { JwtPayload } from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config();

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      SECRET: string;
    }
  }
}

const prisma = new PrismaClient();

const app = express();
app.use(cors());
const GOOGLE_API_FOLDER_ID = "1xh_JAOk1tXbrfPatCtNMhSFqm6P0Jlg2";

const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage });


function checkToken(req: { headers: { [x: string]: string; }; }, res: any, next: any){
  const authHeader = req.headers['authorization'] as string;
  const token = authHeader && authHeader.split(" ")[1]
  if(!token){
    return res.json(401)
  }

  try {
    const secret = process.env.SECRET
    jwt.verify(token, secret)
    console.log('foi')
    next()
  } catch (error) {
    res.json("Token Invalido")
  }
}


app.use(express.json());

app.get('/', function(req, res){
  res.send('Banco de dados');

})


app.get("/post", async function (req, res) {
  const mostrar = await prisma.post.findMany();
  res.json(mostrar);
});

app.get("/user", async function (req, res) {
  const mostrar = await prisma.user.findMany();
  res.json(mostrar);
});


app.post("/getuser", checkToken, async function (req: { body: { token: any; }; }, res: { json: (arg0: { id: number; name: string; email: string; password: string; img: string; } | null) => void; }) {
  try {
    const {token} = req.body
    const secret = process.env.SECRET

    if (!token) {
      return console.error('Token não encontrado na requisição.');
    }

   jwt.verify(token, secret, async (err:any, decoded: string | JwtPayload | undefined) => {
      if (err) {
          console.error('Erro ao decodificar o token:', err);
      } else {
          if (typeof decoded === 'string') {
              console.log('Token decodificado, mas sem payload:', decoded);
          } else {
              const userId = decoded?.id;
              const user = await prisma.user.findUnique({ where: { id:  Number(userId)} });
              res.json(user)
          }
      }
  });
  }catch (err) {
    console.error('Erro ao validar Usuario', err);  
    }
});


app.post("/user/login", async function (req, res) {
  try {
   
    const { email, password } = req.body;
    const userExists = await prisma.user.findUnique({ where: { email: email } });
    if (!userExists) {
      return res.json({ status:404 });
    }
    const checkPassword = await bcrypt.compare(password, userExists!.password)
     if (!checkPassword) {
      return  res.json({ status:401 });
    } else {
      const secret = process.env.SECRET
      const token = jwt.sign(
        { 
          id: userExists.id,
         }, 
         secret
         ,
         )
      
      return res.json({ status: 200, data: userExists, token });
    }
  } catch (err) {
    console.error('Erro ao validar login', err);
    res.status(500).json({ status: 500, error: 'Erro ao validar login' });
  }
});
  
  app.post("/user", upload.single('img'), async function (req, res) {
    try {
      const { name, email, password } = req.body;
      
      const userExists = await prisma.user.findUnique({ where: { email: email } });

      if(userExists){
        return res.json(422)
      }

      const salt = await bcrypt.genSalt(13)
      const passwordHash = await bcrypt.hash(password,salt)
      const imageBuffer = req.file!.buffer;
  
      const link = await uploadFile(name, imageBuffer);
      const newuser = await prisma.user.create({ data: { name, email, password: passwordHash, img: link } });
  
      res.json(newuser);

    } catch (err) {
      console.error('Error creating user', err);
      res.status(500).json({ error: 'Error creating user' });
    }
  });




   
  app.post("/post", upload.single('img'), async function (req, res) {
    try {
      const { title, content, authorId } = req.body;
      const imageBuffer = req.file!.buffer;
  
      const link = await uploadFile(title, imageBuffer);
      const novoUsuario = await prisma.post.create({ data: { title, content, img: link , authorId: Number(authorId) } });
  
      res.json(novoUsuario);
    } catch (err) {
      console.error('Error creating user', err);
      res.status(500).json({ error: 'Error creating user' });
    }
  });
  
  async function uploadFile(name:any, imageBuffer:any) {
    try {
      const time = new Date().getTime();
      const auth = new google.auth.GoogleAuth({
        keyFile: './drive.json',
        scopes: ['https://www.googleapis.com/auth/drive']
      });
  
      const driveService = google.drive({
        version: 'v3',
        auth
      });
  
      const fileMetaData = {
        'name': `${name}${time}.jpg`,
        'parents': [GOOGLE_API_FOLDER_ID]
      };
  
      const media = {
        mimeType: 'image/jpg',
        body: new stream.PassThrough().end(imageBuffer),
      };
  
      const response = await driveService.files.create({
        requestBody: fileMetaData, 
        media: media,
        fields: 'id',  
      });
  
      const linkImagem = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
  
      return linkImagem;
    } catch (err) {
      console.error('Error uploading the file', err);
      throw err;
    }
  }
  
  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });