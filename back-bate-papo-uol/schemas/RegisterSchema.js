import Joi from "joi";

const registerSchema = Joi.object({
	name: Joi.string().alphanum().min(1).max(20).required(),
});

export default registerSchema;
