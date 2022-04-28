import Joi from "joi";

const sendMessageSchema = Joi.object().keys({
	to: Joi.string().alphanum().min(1).max(20).required(),
	text: Joi.string().min(1).required(),
	type: Joi.string().valid("message", "private_message"),
});

export default sendMessageSchema;
