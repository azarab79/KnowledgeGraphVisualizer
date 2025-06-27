import axios from 'axios';

// Mock axios first
jest.mock('axios');
const mockedAxios = axios;

// Create mock axios instance at the top level
const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
};

mockedAxios.create.mockReturnValue(mockAxiosInstance);
mockedAxios.CancelToken = {
  source: jest.fn(() => ({
    token: 'mock-cancel-token',
    cancel: jest.fn(),
  })),
};
mockedAxios.isCancel = jest.fn();

describe('chatApiService', () => {
  // Import the actual service for testing
  let chatApiService, sendMessage, getConversationHistory, clearConversationHistory, cancelRequest;
  
  beforeAll(async () => {
    // Import after mocking
    const module = await import('../services/chatApiService');
    chatApiService = module.default;
    sendMessage = module.sendMessage;
    getConversationHistory = module.getConversationHistory;
    clearConversationHistory = module.clearConversationHistory;
    cancelRequest = module.cancelRequest;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    const mockMessage = 'Hello, world!';
    const mockHistory = [
      { role: 'user', content: 'Previous message', timestamp: '2023-01-01T00:00:00Z' }
    ];
    const mockResponse = {
      data: {
        response: {
          role: 'assistant',
          content: 'Hello back!',
          timestamp: '2023-01-01T00:01:00Z'
        }
      }
    };

    it('should send message successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await sendMessage(mockMessage, mockHistory);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/message',
        { message: mockMessage, history: mockHistory },
        { cancelToken: 'mock-cancel-token' }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle empty history with default value', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await sendMessage(mockMessage);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/message',
        { message: mockMessage, history: [] },
        { cancelToken: 'mock-cancel-token' }
      );
    });

    it('should provide user-friendly error messages for 500 status', async () => {
      const error = { response: { status: 500 } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(sendMessage(mockMessage, mockHistory)).rejects.toThrow('Server error. Please try again later.');
    });

    it('should handle network errors', async () => {
      const networkError = { request: {} };
      mockAxiosInstance.post.mockRejectedValue(networkError);

      await expect(sendMessage(mockMessage, mockHistory)).rejects.toThrow(
        'Unable to connect to the chat service. Please check your connection.'
      );
    });

    it('should handle cancellation errors', async () => {
      const cancelError = new Error('Cancelled');
      mockedAxios.isCancel.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(cancelError);

      await expect(sendMessage(mockMessage, mockHistory)).rejects.toThrow('Request was cancelled');
    });
  });

  describe('getConversationHistory', () => {
    const mockHistoryResponse = {
      data: {
        history: [
          { role: 'assistant', content: 'Welcome!', timestamp: '2023-01-01T00:00:00Z' }
        ]
      }
    };

    it('should fetch conversation history successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockHistoryResponse);

      const result = await getConversationHistory();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/history');
      expect(result).toEqual(mockHistoryResponse.data.history);
    });

    it('should return empty array when history data is missing', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const result = await getConversationHistory();

      expect(result).toEqual([]);
    });

    it('should return empty array for 404 errors', async () => {
      const error = { response: { status: 404 } };
      mockAxiosInstance.get.mockRejectedValue(error);

      const result = await getConversationHistory();

      expect(result).toEqual([]);
    });

    it('should throw error for other failures', async () => {
      const error = { response: { status: 500 } };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(getConversationHistory()).rejects.toThrow(
        'Failed to fetch conversation history. Please try again.'
      );
    });
  });

  describe('clearConversationHistory', () => {
    const mockClearResponse = {
      data: { message: 'Conversation history cleared successfully.' }
    };

    it('should clear conversation history successfully', async () => {
      mockAxiosInstance.delete.mockResolvedValue(mockClearResponse);

      const result = await clearConversationHistory();

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/history');
      expect(result).toEqual(mockClearResponse.data);
    });

    it('should throw error on failures', async () => {
      const error = { response: { status: 500 } };
      mockAxiosInstance.delete.mockRejectedValue(error);

      await expect(clearConversationHistory()).rejects.toThrow(
        'Failed to clear conversation history. Please try again.'
      );
    });
  });

  describe('service object', () => {
    it('should export all required functions', () => {
      expect(chatApiService.sendMessage).toBeDefined();
      expect(chatApiService.getConversationHistory).toBeDefined();
      expect(chatApiService.clearConversationHistory).toBeDefined();
      expect(chatApiService.cancelRequest).toBeDefined();
    });
  });
}); 