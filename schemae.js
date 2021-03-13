const yup = require('yup');

const valueSchema = yup.lazy((value) => {
    switch (value?.type) {
        case 'fixed':
            return fixedSchema;
        case 'number':
            return numberSchema;
        case 'pool':
            return poolSchema;
        case 'array':
            return arraySchema;
        case 'object':
            return objectSchema;
        default:
            return baseValueSchema;
    }
});

const baseValueSchema = yup.object().strict().shape({
    type: yup.string().oneOf(['fixed', 'number', 'pool', 'array', 'object']).required()
}).noUnknown();

const fixedSchema = baseValueSchema.shape({
    type: yup.string().oneOf(['fixed']).required(),
    values: yup.array().of(yup.mixed().defined()).min(1).required()
});

const numberSchema = baseValueSchema.shape({
    type: yup.string().oneOf(['number']).required(),
    min: yup.number().required(),
    max: yup.number().test('', '', (value, context) => value >= context.parent.min).required(),
    scale: yup.number().integer().min(0).required()
});

const poolSchema = baseValueSchema.shape({
    type: yup.string().oneOf(['pool']).required(),
    values: yup.array().of(yup.object().shape({
        value: valueSchema,
        weight: yup.number().integer().min(0).required()
    }).noUnknown()).min(1).required()
});

const arraySchema = baseValueSchema.shape({
    type: yup.string().oneOf(['array']).required(),
    minlength: yup.number().integer().min(0).required(),
    maxlength: yup.number().integer().min(0).test('', '', (value, context) => value >= context.parent.minlength).required(),
    value: valueSchema
});

const objectSchema = baseValueSchema.shape({
    type: yup.string().oneOf(['object']).required(),
    fields: yup.array().of(yup.object().shape({
        label: yup.string(),
        value: valueSchema,
        presence: yup.number().min(0).max(1).required()
    }).noUnknown()).required()
});

module.exports = { valueSchema };