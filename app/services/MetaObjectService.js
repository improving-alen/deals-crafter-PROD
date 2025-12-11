// Service for handling metaobject operations
export class MetaObjectService{
  constructor(admin) {
    this.admin = admin;
  }

  // Helper function to execute GraphQL queries
  async executeGraphQL(query, variables = {}) {
    console.log(`>>> [MetaobjectService] Executing GraphQL query...`);
    const response = await this.admin.graphql(query, { variables });
    const result = await response.json();
    
    if (result.errors) {
      console.error(`>>> [MetaobjectService] GraphQL ERROR:`, JSON.stringify(result.errors, null, 2));
    }
    
    return result;
  }

  // Get existing metaobjects by type
  async getMetaobjectsByType(type) {
    const query = `
      query GetExistingMetaobjects($type: String!) {
        metaobjects(type: $type, first: 100) {
          edges {
            node {
              id
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const result = await this.executeGraphQL(query, { type });
    return result.data?.metaobjects?.edges || [];
  }

  // Delete all metaobjects of a specific type
  async deleteMetaobjectsByType(type) {
    console.log(`>>> [MetaobjectService] Deleting metaobjects of type: ${type}`);
    
    const metaobjects = await this.getMetaobjectsByType(type);
    console.log(`>>> [MetaobjectService] Found ${metaobjects.length} metaobjects to delete`);

    if (metaobjects.length === 0) {
      return true; // Nothing to delete
    }

    const deleteMutation = `
      mutation MetaobjectDelete($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `;

    for (const edge of metaobjects) {
      const metaobjectId = edge.node.id;
      console.log(`>>> [MetaobjectService] Deleting metaobject: ${metaobjectId}`);
      
      const deleteResult = await this.executeGraphQL(deleteMutation, { id: metaobjectId });

      if (deleteResult.errors || deleteResult.data?.metaobjectDelete?.userErrors?.length > 0) {
        console.error('>>> [MetaobjectService] Error deleting metaobject:', deleteResult.errors || deleteResult.data?.metaobjectDelete?.userErrors);
        return false;
      }
    }

    console.log(`>>> [MetaobjectService] Successfully deleted ${metaobjects.length} metaobjects of type ${type}`);
    return true;
  }

  // Create or update a metaobject
  async upsertMetaobject(type, handle, fields) {
    const mutation = `
      mutation MetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
        metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
          metaobject {
            id
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    fields = fields.map(f => ({
        key: f.key,
        value: typeof f.value === "boolean" ? (f.value ? "true" : "false") : f.value
    }));

    const variables = {
      handle: {
        type: type,
        handle: handle
      },
      metaobject: {
        fields: fields
      }
    };

    const result = await this.executeGraphQL(mutation, variables);

    if (result.errors || result.data?.metaobjectUpsert?.userErrors?.length > 0) {
      console.error(`>>> [MetaobjectService] Error upserting metaobject ${type}:`, result.errors || result.data?.metaobjectUpsert?.userErrors);
      return false;
    }

    console.log(`>>> [MetaobjectService] Successfully upserted metaobject: ${type} - ${handle}`);
    return true;
  }

  // Load configuration from metaobjects
  async loadConfiguration(type, fieldMappings) {
    const metaobjects = await this.getMetaobjectsByType(type);
    
    return metaobjects.map(edge => {
      const fields = edge.node.fields;
      const config = {};
      
      Object.keys(fieldMappings).forEach(key => {
        const fieldKey = fieldMappings[key];
        const field = fields.find(f => f.key === fieldKey);
        config[key] = field ? field.value : '';
      });
      
      return config;
    });
  }
}