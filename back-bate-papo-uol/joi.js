import Joi from "joi";

const schema = Joi.object({
	name: Joi.string().alphanum().min(1).max(20).required(),
});

export default schema;
