import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { google } from 'googleapis';
import stream from 'stream';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt'

const prisma = new PrismaClient();

const app = express();
app.use(cors());
const GOOGLE_API_FOLDER_ID = "1xh_JAOk1tXbrfPatCtNMhSFqm6P0Jlg2";

const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage });

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


app.post("/getuser", async function (req, res) {
  try {
    const {id} = req.body
    const user = await prisma.user.findUnique({ where: { id:  Number(id)} });
    res.json(user)
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
      return res.json({ status: 200, data: userExists });
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