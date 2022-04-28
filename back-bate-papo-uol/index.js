import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const server = express();
server.use(cors());
server.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

server.listen(5000, () => {
	console.log(chalk.green.bold("Servidor Funcionando"));
});
