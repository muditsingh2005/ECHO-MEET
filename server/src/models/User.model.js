import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


const userSchema = new Schema({
    
    name :{
        type:String,
        required:true,
    },
    email :{
        type:String,
        required:true,
        unique:true,
        lowercase: true,
        trim: true,
    },
    password :{
        type:String,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allows null values while maintaining uniqueness
    },
    avatar :{
        type:String,
    },  
    createdAt :{
        type:Date,
        default:Date.now,
    },
    refreshToken: {
        type: String,
        default: null,
    },
    blacklistedTokens: [{
        token: String,
        blacklistedAt: {
            type: Date,
            default: Date.now,
            expires: 7 * 24 * 60 * 60 // Auto-delete after 7 days
        }
    }],
})



userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      name: this.name,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRT,
    }
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
