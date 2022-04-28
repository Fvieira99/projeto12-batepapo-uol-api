import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from "dayjs";

import schema from "./joi.js";

dotenv.config();

const server = express();
server.use(cors());
server.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

server.post("/participants", async (req, res) => {
	try {
		await mongoClient.connect();
		const database = mongoClient.db("api-uol");

		const validation = await schema.validateAsync(req.body);
		console.log(validation);

		const nameDoesExist = await database
			.collection("participants")
			.findOne({ name: req.body.name });

		if (nameDoesExist) {
			throw res.status(409).send(`${req.body.name} já está em uso.`);
		}
		await database
			.collection("participants")
			.insertOne({ ...req.body, lastStatus: Date.now() });

		await database.collection("messages").insertOne({
			from: req.body.name,
			to: "Todos",
			text: "entra na sala...",
			type: "status",
			time: dayjs().locale("pt-br").format("HH:mm:ss"),
		});
		res.sendStatus(201);
		mongoClient.close();
	} catch (e) {
		if (e.isJoi === true) {
			console.log(e);
			res.status(422).send(e.message);
		}
	}
});

server.get("/participants", async (req, res) => {
	try {
		await mongoClient.connect();
		const database = mongoClient.db("api-uol");

		const participants = await database
			.collection("participants")
			.find({})
			.toArray();
		res.send(participants);
		mongoClient.close();
	} catch (e) {
		res.send("Não foi possível carregar os participantes");
		mongoClient.close();
	}
});

server.listen(5000, () => {
	console.log(chalk.green.bold("Servidor Funcionando"));
});
