import mongoose from 'mongoose';

const connectDb=async()=>{
    try{
        mongoose.connection.on('connected',()=>console.log("conection succesfull"))
        mongoose.connection.on('error',()=>console.log("conection failed"))


await mongoose.connect(process.env.MONGO_URI,{
dbName:"calender",
    })
    }catch(error){
        comnsole.log(error)
    }
    
}