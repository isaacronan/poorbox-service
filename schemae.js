const yup = require('yup');

const valueSchema = yup.lazy((value) => {
    switch (value?.type) {
        case 'primitive':
            return primitiveSchema;
        case 'number':
            return numberSchema;
        case 'multi':
            return multiSchema;
        case 'array':
            return arraySchema;
        case 'object':
            return objectSchema;
        default:
            return baseValueSchema;
    }
});

const baseValueSchema = yup.object().strict().shape({
    type: yup.string().oneOf(['primitive', 'number', 'multi', 'array', 'object']).required()
}).noUnknown();

const primitiveSchema = baseValueSchema.shape({
    type: yup.string().oneOf(['primitive']).required(),
    values: yup.array().of(yup.mixed().defined()).min(1).required()
});

const numberSchema = baseValueSchema.shape({
    type: yup.string().oneOf(['number']).required(),
    min: yup.number().required(),
    max: yup.number().test('', '', (value, context) => value >= context.parent.min).required(),
    scale: yup.number().integer().min(0).required()
});

const multiSchema = baseValueSchema.shape({
    type: yup.string().oneOf(['multi']).required(),
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
        label: yup.string().required(),
        value: valueSchema,
        presence: yup.number().min(0).max(1).required()
    }).noUnknown()).required()
});

module.exports = { valueSchema };