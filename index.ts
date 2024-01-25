import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { google } from 'googleapis';
import stream from 'stream';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const app = express();
app.use(cors());
const GOOGLE_API_FOLDER_ID = "1xh_JAOk1tXbrfPatCtNMhSFqm6P0Jlg2";

const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage });

app.use(express.json());

app.get("/user", async function (req, res) {
  const mostrar = await prisma.user.findMany();
  res.json(mostrar);
});

app.post("/user/login", async function (req, res) {
    try {
      const { email, password } = req.body;
      const userExists = await prisma.user.findUnique({ where: { email: email } });
  
      if (!userExists) {
        res.json(false);
      } else if (userExists.password === password) {
        res.json(userExists);
      } else {
        res.json(null);
      }
    } catch (err) {
      console.error('Erro ao validar login', err);
      res.status(500).json({ error: 'Erro ao validar login' });
    }
  });
  
  app.post("/user", upload.single('img'), async function (req, res) {
    try {
      const { name, email, password } = req.body;
      const imageBuffer = req.file!.buffer;
  
      const link = await uploadFile(name, imageBuffer);
      const novoUsuario = await prisma.user.create({ data: { name, email, password, img: link } });
  
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