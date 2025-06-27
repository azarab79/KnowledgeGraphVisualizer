# 360T Knowledge Graph - Data Model Guide

This guide summarizes the data model of the 360T Knowledge Graph.

## Node Types

- **Module**: `name`, `description`, `version`, `owner`, `status`
- **Product**: `name`, `description`, `assetClass`, `isActive`
- **Workflow**: `name`, `description`, `steps`, `avgDuration`
- **UI_Area**: `name`, `description`, `path`, `accessLevel`
- **ConfigurationItem**: `name`, `description`, `defaultValue`, `allowedValues`, `isRequired`
- **TestCase**: `name`, `description`, `testType`, `status`, `lastRun`

## Relationship Types

- **CONTAINS**: Component containment
- **DISPLAYS**: Module to UI area
- **USES**: Workflow to module
- **CONFIGURES_IN**: Config item to module
- **REQUIRES**: Module dependencies
- **VALIDATES**: Test case to component
- **NAVIGATES_TO**: UI navigation flow
- **CONNECTS_TO**: System integration points

## Constraints & Indexes

- Unique constraints on `name` for all node types.
- Property existence constraints on key properties.
- Use indexes to optimize query performance.

## Best Practices

- Use unique, descriptive `name` properties.
- Maintain consistent naming and data types.
- Create meaningful relationships reflecting architecture.
- Use parameters and indexes in queries.
- Regularly review and clean data.

## Support

- Documentation: Contact docs team
- Technical Support: kg-support@360t.com
- Data Model Changes: Follow change management process
