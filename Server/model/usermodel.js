import mongoose from "mongoose";


const userscema=mongoose.Schema({
    googleId:{
        type:String,
        required:true,
        unique:true,
    },
    name:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
    },
    picture:{
        type:String,
    }


})

const userScema=mongoose.model("User",userscema)
 export default userScema;