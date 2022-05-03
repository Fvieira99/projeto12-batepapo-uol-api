import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";

import registerSchema from "./Validation-Schemas/RegisterSchema.js";
import sendMessageSchema from "./Validation-Schemas/SendMessageSchema.js";

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
	const name = stripHtml(req.body.name).result.trim();

	const validation = registerSchema.validate({ ...req.body, name: name });

	if (validation.error) {
		res.status(422).send(validation.error.message);
		return;
	}

	try {
		const nameDoesExist = await database
			.collection("participants")
			.findOne({ name: name });

		if (nameDoesExist) {
			res.status(409).send(`${name} já está em uso.`);
			return;
		}
		await database
			.collection("participants")
			.insertOne({ name: name, lastStatus: Date.now() });

		await database.collection("messages").insertOne({
			from: name,
			to: "Todos",
			text: "entra na sala...",
			type: "status",
			time: dayjs().locale("pt-br").format("HH:mm:ss"),
		});
		res.status(201).send({ name: name });
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
	const limit = parseInt(req.query.limit);
	const { user } = req.headers;
	try {
		const messages = await database
			.collection("messages")
			.find({
				$or: [{ to: "Todos" }, { to: user }, { from: user }],
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
	const { user } = req.headers;

	const bodyValidation = sendMessageSchema.validate(req.body);
	if (bodyValidation.error) {
		res.status(422).send(bodyValidation.error.message);
		return;
	}
	try {
		const isRegistered = await database.collection("participants").findOne({
			name: user,
		});

		if (!isRegistered) {
			res.status(422).send(`${user} não está registrado`);
			return;
		}

		await database.collection("messages").insertOne({
			...req.body,
			text: stripHtml(req.body.text).result.trim(),
			from: user,
			time: dayjs().locale("pt-br").format("HH:mm:ss"),
		});
		res.status(201).send("sua mensagem foi enviada");
	} catch (e) {
		res.sendStatus(500);
	}
});

server.post("/status", async (req, res) => {
	const { user } = req.headers;

	try {
		const userExists = await database
			.collection("participants")
			.findOne({ name: user });

		if (!userExists) {
			res.status(404).send("Usuário não foi registrado ainda.");
			return;
		}

		await database
			.collection("participants")
			.updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
		res.sendStatus(200);
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
