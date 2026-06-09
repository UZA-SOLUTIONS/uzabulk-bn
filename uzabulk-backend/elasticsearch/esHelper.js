const esClient = require("./esConfig");

module.exports = {
    indexExists: async (index) => {
        try {
            const exists = await esClient.indices.exists({ index });
            console.log(`Index exists for '${index}':`, exists);
            return exists;
        } catch (error) {
            console.error(`Error checking if index '${index}' exists:`, error);
            return false;
        }
    },

    createIndex: async (index, mapping) => {
        try {
            await esClient.indices.create({
                index,
                body: mapping,
            });
            console.log(`Index '${index}' created successfully.`);
        } catch (error) {
            // Handle the case where the index already exists
            if (error.meta && error.meta.body.error.type === 'resource_already_exists_exception') {
                console.log(`Index '${index}' already exists. Skipping creation.`);
            } else {
                console.error('Error creating index:', error);
            }
        }
    },

    updateMapping: async (index, mapping) => {
        try {
            const existingMapping = await esClient.indices.getMapping({ index });
            const currentProperties = existingMapping[index].mappings.properties;

            // Compare the current mapping with the desired mapping and update if necessary
            for (const [field, config] of Object.entries(mapping.mappings.properties)) {
                if (!currentProperties[field] || JSON.stringify(currentProperties[field]) !== JSON.stringify(config)) {
                    await esClient.indices.putMapping({
                        index,
                        body: { properties: { [field]: config } },
                    });
                    console.log(`Field '${field}' updated or added to index '${index}'.`);
                }
            }
        } catch (error) {
            console.error('Error updating mapping:', error);
        }
    },

    getAliasTargetIndex: async (aliasName) => {
        try {
            const data = await esClient.indices.getAlias({ name: aliasName });
            const indices = Object.keys(data || {});
            return indices[0] || "";
        } catch (error) {
            if (error?.meta?.statusCode === 404) return "";
            console.error(`Error resolving alias '${aliasName}':`, error);
            return "";
        }
    },

    pointAliasToIndex: async (aliasName, indexName) => {
        try {
            const currentIndex = await module.exports.getAliasTargetIndex(aliasName);
            const actions = [];
            if (currentIndex && currentIndex !== indexName) {
                actions.push({ remove: { index: currentIndex, alias: aliasName } });
            }
            if (!currentIndex || currentIndex !== indexName) {
                actions.push({ add: { index: indexName, alias: aliasName } });
            }
            if (!actions.length) return;
            await esClient.indices.updateAliases({ body: { actions } });
            console.log(`Alias '${aliasName}' now points to '${indexName}'.`);
        } catch (error) {
            console.error(`Error updating alias '${aliasName}' -> '${indexName}':`, error);
        }
    },
};