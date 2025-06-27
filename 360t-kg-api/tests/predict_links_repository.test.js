const neo4j = require('neo4j-driver');
const GraphRepository = require('../src/repositories/GraphRepository');

describe('GraphRepository.predictLinks', () => {
  /**
   * Build a mock Neo4j session whose run() implementation inspects the Cypher
   * query string and returns canned responses appropriate for the unit-test.
   */
  const createMockSession = () => {
    // Helper to emulate Neo4j integer wrapper when necessary
    const toNeoInt = (n) => ({ toNumber: () => n });

    const fakeRecords = {
      // Model list query returns fresh model (timestamp now)
      modelList: [{
        get: (key) => {
          if (key === 'creationTimeEpochMillis') return Date.now();
          return null;
        }
      }],
      // Prediction stream returns two example links
      predict: [
        {
          get: (key) => {
            if (key === 'sourceNodeId') return 1;
            if (key === 'targetNodeId') return 2;
            if (key === 'probability') return 0.9;
            return null;
          }
        },
        {
          get: (key) => {
            if (key === 'sourceNodeId') return 3;
            if (key === 'targetNodeId') return 4;
            if (key === 'probability') return 0.8;
            return null;
          }
        }
      ]
    };

    return {
      run: jest.fn((query) => {
        if (query.includes('gds.beta.model.list')) {
          return Promise.resolve({ records: fakeRecords.modelList });
        }
        if (query.includes('predict.stream')) {
          return Promise.resolve({ records: fakeRecords.predict });
        }
        // For all other Cypher calls, return empty result set
        return Promise.resolve({ records: [] });
      }),
      close: jest.fn(() => Promise.resolve())
    };
  };

  const mockDriver = {
    session: createMockSession
  };

  it('should return predictions array with expected shape', async () => {
    const repository = new GraphRepository(mockDriver);
    const result = await repository.predictLinks(5, 0.5);

    expect(result).toHaveProperty('predictions');
    expect(Array.isArray(result.predictions)).toBe(true);
    expect(result.predictions.length).toBe(2);

    const first = result.predictions[0];
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('target');
    expect(first).toHaveProperty('probability');
  });
}); 