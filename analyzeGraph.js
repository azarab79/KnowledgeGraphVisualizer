// Neo4j connection configuration
const uri = process.env.NEO4J_URI || 'neo4j://localhost:7695';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

// Create a Neo4j driver instance
const driver = neo4j.driver(
  uri, 
  neo4j.auth.basic(user, password),
  {
    encrypted: 'ENCRYPTION_OFF',
    trust: 'TRUST_ALL_CERTIFICATES'
  }
); 