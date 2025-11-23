import jwt from "jsonwebtoken";
import {OAuth2Client} from "google-auth-library";

import User from "../model/usermodel.js";


const client=new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googelAuth=async(req,res)=>{
    try{
        const {token}=req.body;

        const ticket=await client.verifyIdToken({
            idToken:token,
            audience:process.env.GOOGLE_CLIENT_ID
        })
        const paylode=ticket.getPaylode();
        const {sub,name,email,picture}=paylode;

        console.log(paylode);


        let user=await User.findOne({googleId:sub});
        if(!user){
            user =new User({
                googleid:sub,
                name,
                email,
                picture
            });
            await user.save();
        }
        const JwtToken=jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"7d"});
        res.status(200).json({user,JwtToken});


    }catch(error){
console.log(error);
res.status(401).json({message:"Authentication failed"})
    }
}