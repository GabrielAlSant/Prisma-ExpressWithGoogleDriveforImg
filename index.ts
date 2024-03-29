import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { google } from 'googleapis';
import stream from 'stream';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt'
import jwt, { JwtPayload } from 'jsonwebtoken'
import dotenv from 'dotenv'



const port = 8080

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
    next()
  } catch (error) {
    res.json(401)
  }
}


app.use(express.json());

app.get('/', function(req, res){
  res.send('Banco de dados');

})


app.get('/friend', async function (req, res) {
  const mostrar = await prisma.friend.findMany() 
  res.json(mostrar);
});


app.get("/post", async function (req, res) {
  const mostrar = await prisma.post.findMany({
    include: {
      author:true,
      commensts:{
        include: {
          author: true,
        },
      },
    },orderBy:{
      postDate : "desc"
    }
  });
  res.json(mostrar);
});


app.get("/postuser/:id", async function (req, res) {
  const {id} = req.params
  const mostrar = await prisma.post.findMany({
    where:{
      authorId: Number(id),
    },
    include: {
      author:true,
      commensts:{
        include: {
          author: true,
        },
      },
    },
     orderBy:{
      postDate : "desc"
    }
  });
  res.json(mostrar);
});

app.get("/user", async function (req, res) {
  const mostrar = await prisma.user.findMany({
    include:{
      friendInvited:true,
      friend:true
    }
  });
  res.json(mostrar);
});

app.get("/getinvite/:id", async function (req, res) {
  const {id} = req.params 
  const mostrar = await prisma.invite.findMany({
  where:{
    userInvitedId: Number(id)
  },
    include:{
      userSend:true,
      userInvited:true
    }
  });
  res.json(mostrar);
});


app.get("/getfriends/:id", async function (req, res) {
    const {id} = req.params
    const mostrar = await prisma.friend.findMany({
      where: {
        OR: [
          { invitedUserId: Number(id) },
          { userEnvId: Number(id) }
        ]
      },
      include: {
        invitedUser: true,
        userEnv: true,
        chat:true
       } 
      })
    res.json(mostrar);
});

app.get("/chat/:id", async function (req, res) {
  const { id } = req.params;
  try {
    const chats = await prisma.friend.findMany({
      where: {
        OR: [
          { invitedUserId: Number(id) },
          { userEnvId: Number(id) }
        ]
      },
      include: {
      chat:{
        include:{
          messages:true
        }
      } 
      },
    });
    res.json(chats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



app.get("/chatmessages", async function (req, res) {
  const {id} = req.body
  const mostrar = await prisma.chatMessage.findMany({
    where:{
      chatId : id
    },
    include:{
      sender:true
    }
  });
  res.json(mostrar);
});

app.post('/invite', async function (req, res) {
 const {userSend, userInvited} = req.body
  try {
    const newinvite = await prisma.invite.create({data:{userSendId: Number(userSend), userInvitedId:Number(userInvited)}})
    res.json(newinvite)
  } catch (error) {
    console.log(error)
    res.json(error)
  } 
})

app.post('/friend', async function (req, res) {
   try {
    const {inviteId, userEnvId, invitedUserId} = req.body
     const newFriend = await prisma.friend.create({data:{userEnvId: Number(userEnvId), invitedUserId:Number(invitedUserId)}})
     const newChat = await prisma.chat.create({data:{ friendID: newFriend.id}})
     await prisma.invite.delete({where:{id:Number(inviteId)}})
     res.json(401)
 
   } catch (error) {
     console.log(error)
     res.json(error)
   } 
 })

 app.post('/messages', async function (req, res) {
  const {content, senderId, chatId} = req.body
  let imageBuffer
  let link
      if(req.file?.buffer)
      {
        console.log(req.file?.buffer)
        imageBuffer = req.file!.buffer;
        link = await uploadFile(senderId, imageBuffer);
      }
  
   try {
     const newMessage = await prisma.chatMessage.create({data:{ content, img:link, senderId, chatId: Number(chatId)}})
     res.json(newMessage)
   } catch (error) {
     console.log(error)
     res.json(error)
   } 
 })



app.post("/getuser", checkToken, async function (req: { body: { token: any; }; }, res: { json: (arg0: { id: number; name: string; email: string; password: string; img: string; } | null) => void; }) {
  try {
    const {token} = req.body;
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
         secret,
         {expiresIn: '1d'}
         ,
         )
      
      return res.json({ status: 200, data: userExists, token });
    }
  } catch (err) {
    console.error('Erro ao validar login', err);
    res.status(500).json({ status: 500, error: 'Erro ao validar login' });
  }
});
  
app.post("/comment", async function (req, res) {
  try {
    const {text, authorId, postId} = req.body;

    const newcomment = await prisma.comment.create({data: {text, authorId: Number(authorId), postId: Number(postId)}})
    res.json(newcomment)
  } catch (error) {
    console.error('Error creating comment', error);
    res.status(500).json({ error: 'Error creating comment' });
  }
})


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


  app.put("/user", upload.single('img'), async function (req, res) {
    try {
      const { name, email, password, lastPassword } = req.body;
      
      const userExists = await prisma.user.findUnique({ where: { email: email } });
      let link
      let passwordHash 
      let imageBuffer

      if(!userExists){
        return res.json(404)
      }

      if(lastPassword){ 
      const checkPassword = await bcrypt.compare(lastPassword, userExists!.password)

      if (!checkPassword) {
        console.log("senha antiga incorreta")
        return  res.json(401);
        
      }
      const salt = await bcrypt.genSalt(13)
      console.log(password)
      passwordHash = await bcrypt.hash(password, salt)

    }else{
      passwordHash = userExists.password
    }
      if(req.file?.buffer){
        imageBuffer = req.file!.buffer
        link = await uploadFile(name, imageBuffer);
        const idMatch = userExists.img.match(/id=(.*)/);
        if (idMatch && idMatch[1]) {
            const idImg: string = idMatch[1];
            deleteFileGoogleDrive(idImg)
        } else {
            console.log("Nenhum número encontrado após 'id='");
        }
    }else{
      link = userExists.img
    }

      const updateuser = await prisma.user.update({
        data: { name : name || userExists!.name, email: email, password: passwordHash , img: link },
        where: {email: email}
      });
  
      res.json(updateuser);

    } catch (err) {
      console.error('Error creating user', err);
      res.status(500).json({ error: 'Error creating user' });
    }
  });




   
  app.post("/post", upload.single('img'), async function (req, res) {
    try {
      const { title, content, authorId } = req.body;
      let imageBuffer
      let link
      if(req.file?.buffer)
      {
        console.log(req.file?.buffer)
        imageBuffer = req.file!.buffer;
        link = await uploadFile(title, imageBuffer);
      }
   
      const newpost = await prisma.post.create({ data: { title, content, img: link , authorId: Number(authorId) } });
  
      res.json(newpost);
    } catch (err) {
      console.error('Error creating user', err);
      res.status(500).json({ error: 'Error creating user' });
    }
  });

  

app.delete("/user/:id", async function(req, res){
  try {
    const {id} = req.params
    const deleteduser = await prisma.user.delete({where:{ id: Number(id)}})
    res.json(deleteduser)
  } catch (error) {
    console.error(error)
  }
})

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
  
  const deleteFileGoogleDrive = async (fileId: string) => {
    
    const auth = new google.auth.GoogleAuth({
        keyFile: './drive.json',
        scopes: ['https://www.googleapis.com/auth/drive']
    })
    const driveService = google.drive({ version: 'v3', auth })

    try {
        await driveService.files.delete({ fileId });
       
    } catch (error) {
        console.error(`Ocorreu um erro ao excluir o arquivo: ${error}`);
    }
}



const server = app.listen(port, () => {
  console.log('Server is running on port', port);
});

const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

  declare global {
    var onlineUsers: any;
    var chatSocket: any;
}

global.onlineUsers = new Map();



io.on("connection", (socket:any) => {
  global.chatSocket = socket;
  socket.on("add-user", (userId : number) => {
    onlineUsers.set(userId, socket.id);
  });
  
  socket.on("send-msg", (data: any) => {
    const received = Number(data.values.to)  
    const sendUserSocket = onlineUsers.get(received);
    console.log('idsocket',sendUserSocket)
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("msg-recieve", data.values);
    }
  });
});