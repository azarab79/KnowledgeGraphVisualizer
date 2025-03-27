const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

const graphQueryValidation = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    query('nodeTypes')
        .optional()
        .isString()
        .custom(value => {
            const validTypes = ['Module', 'Product', 'Workflow', 'ConfigurationItem', 'TestCase', 'UI_Area'];
            const types = value.split(',');
            return types.every(type => validTypes.includes(type));
        })
        .withMessage('Invalid node type specified'),
    handleValidationErrors
];

const nodeValidation = [
    body('name').notEmpty().trim().escape(),
    body('type').isIn(['Module', 'Product', 'Workflow', 'ConfigurationItem', 'TestCase', 'UI_Area']),
    body('properties').isObject(),
    handleValidationErrors
];

const relationshipValidation = [
    body('fromNode').notEmpty(),
    body('toNode').notEmpty(),
    body('type').isIn(['IMPLEMENTS', 'DEPENDS_ON', 'INTEGRATES_WITH', 'USES', 'CONFIGURES', 'VALIDATES', 'DISPLAYS', 'NAVIGATES_TO']),
    body('properties').optional().isObject(),
    handleValidationErrors
];

module.exports = {
    graphQueryValidation,
    nodeValidation,
    relationshipValidation
}; 