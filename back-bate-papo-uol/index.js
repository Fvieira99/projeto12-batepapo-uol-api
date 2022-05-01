import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from "dayjs";

import registerSchema from "./schemas/RegisterSchema.js";
import sendMessageSchema from "./schemas/SendMessageSchema.js";

dotenv.config();

const server = express();
server.use(cors());
server.use(json());

let database;
const mongoClient = new MongoClient(process.env.MONGO_URI);

const promise = mongoClient.connect();
promise.then(() => {
	database = mongoClient.db(process.env.MONGO_DB);
});
promise.catch(() => {
	console.log("Não foi possível acessar o banco de dados");
});

server.post("/participants", async (req, res) => {
	const validation = registerSchema.validate(req.body);
	if (validation.error) {
		res.status(422).send(e.message);
		return;
	}

	try {
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
		deleteIfInactive();
	} catch (e) {
		res.sendStatus(422);
	}
});

server.get("/participants", async (req, res) => {
	try {
		const participants = await database
			.collection("participants")
			.find({})
			.toArray();
		res.send(participants);
	} catch (e) {
		res.status(422).send("Não foi possível carregar os participantes");
	}
});

server.get("/messages", async (req, res) => {
	try {
		const limit = parseInt(req.query.limit);
		const messages = await database
			.collection("messages")
			.find({
				$or: [
					{ to: "Todos" },
					{ to: req.headers.user },
					{ from: req.headers.user },
				],
			})
			.toArray();
		if (limit) {
			if (messages.length <= limit) {
				res.send(messages);
				return;
			}
			res.send([...messages].splice(messages.length - limit, messages.length));
			return;
		}
		res.send(messages);
	} catch (e) {
		console.log(e);
		res.send(e);
	}
});

server.post("/messages", async (req, res) => {
	const bodyValidation = sendMessageSchema.validate(req.body);
	if (bodyValidation.error) {
		res.status(422).send(bodyValidation.error.message);
		return;
	}
	try {
		const isRegistered = await database.collection("participants").findOne({
			name: req.headers.user,
		});

		if (!isRegistered) {
			throw res.status(422).send(`${req.headers.user} não está registrado`);
		}

		await database.collection("messages").insertOne({
			...req.body,
			from: req.headers.user,
			time: dayjs().locale("pt-br").format("HH:mm:ss"),
		});
		res.status(201).send("sua mensagem foi enviada");
	} catch (e) {
		res.sendStatus(500);
	}
});

server.post("/status", async (req, res) => {
	try {
		const userExists = await database
			.collection("participants")
			.findOne({ name: req.headers.user });

		if (!userExists) {
			res.status(404).send("Usuário não foi registrado ainda.");
			return;
		}

		await database
			.collection("participants")
			.updateOne(
				{ name: req.headers.user },
				{ $set: { lastStatus: Date.now() } }
			);
		res.sendStatus(200);
		console.log("Status Atualizado");
	} catch (e) {
		res.sendStatus(500);
	}
});

function deleteIfInactive() {
	setInterval(async () => {
		try {
			const participants = await database
				.collection("participants")
				.find({})
				.toArray();
			if (!participants) {
				console.log("Ainda não existem usuários");
				return;
			}

			participants.forEach(async (participant) => {
				console.log(participant.lastStatus);
				if (Date.now() - parseInt(participant.lastStatus) > 10000) {
					try {
						await database
							.collection("participants")
							.deleteOne({ name: participant.name });
						await database.collection("messages").insertOne({
							from: participant.name,
							to: "Todos",
							text: "Sai da sala...",
							type: "status",
							time: dayjs().locale("pt-br").format("HH:mm:ss"),
						});
						console.log("Participante deletado e mensagem enviada");
					} catch (e) {
						console.log(e);
					}
				}
			});
		} catch (e) {
			console.log(e);
		}
	}, 15000);
}
server.listen(5000, () => {
	console.log(chalk.green.bold("Servidor Funcionando"));
});
