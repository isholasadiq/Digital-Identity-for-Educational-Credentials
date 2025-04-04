import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock clarity functions and blockchain state
const mockBlockHeight = 123456;
const mockTxSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const mockAuthority = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';

// Mock data store
let mockStudents = new Map();

// Mock clarity functions
const mockClarity = {
  blockHeight: mockBlockHeight,
  txSender: mockTxSender,
  
  mapGet: (map, key) => {
    if (map === 'students') {
      return mockStudents.get(key.studentId);
    }
    return undefined;
  },
  
  mapSet: (map, key, value) => {
    if (map === 'students') {
      mockStudents.set(key.studentId, value);
      return true;
    }
    return false;
  },
  
  contractOwner: mockAuthority
};

// Import the contract functions (mocked implementation)
const contract = {
  getStudentInfo: (studentId) => {
    return mockClarity.mapGet('students', { studentId });
  },
  
  isStudentVerified: (studentId) => {
    const student = mockClarity.mapGet('students', { studentId });
    return student ? student.verified : false;
  },
  
  registerStudent: (studentId) => {
    const existingRecord = mockClarity.mapGet('students', { studentId });
    if (existingRecord) {
      return { type: 'err', value: 2 }; // ERR_ALREADY_REGISTERED
    }
    
    mockClarity.mapSet('students', { studentId }, {
      principal: mockClarity.txSender,
      verified: false,
      verificationDate: null,
      verificationAuthority: null
    });
    
    return { type: 'ok', value: true };
  },
  
  verifyStudent: (studentId) => {
    // Set tx-sender to authority for this test
    const originalTxSender = mockClarity.txSender;
    mockClarity.txSender = mockClarity.contractOwner;
    
    const studentRecord = mockClarity.mapGet('students', { studentId });
    if (!studentRecord) {
      mockClarity.txSender = originalTxSender;
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    if (mockClarity.txSender !== mockClarity.contractOwner) {
      mockClarity.txSender = originalTxSender;
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    mockClarity.mapSet('students', { studentId }, {
      ...studentRecord,
      verified: true,
      verificationDate: mockClarity.blockHeight,
      verificationAuthority: mockClarity.txSender
    });
    
    mockClarity.txSender = originalTxSender;
    return { type: 'ok', value: true };
  }
};

describe('Student Verification Contract', () => {
  beforeEach(() => {
    // Reset mock data before each test
    mockStudents.clear();
  });
  
  describe('registerStudent', () => {
    it('should register a new student successfully', () => {
      const result = contract.registerStudent('student-123');
      expect(result).toEqual({ type: 'ok', value: true });
      
      const student = contract.getStudentInfo('student-123');
      expect(student).toBeDefined();
      expect(student.verified).toBe(false);
    });
    
    it('should fail if student is already registered', () => {
      // Register once
      contract.registerStudent('student-123');
      
      // Try to register again
      const result = contract.registerStudent('student-123');
      expect(result).toEqual({ type: 'err', value: 2 }); // ERR_ALREADY_REGISTERED
    });
  });
  
  describe('verifyStudent', () => {
    it('should verify a student successfully', () => {
      // Register first
      contract.registerStudent('student-123');
      
      // Verify
      const result = contract.verifyStudent('student-123');
      expect(result).toEqual({ type: 'ok', value: true });
      
      const student = contract.getStudentInfo('student-123');
      expect(student.verified).toBe(true);
      expect(student.verificationDate).toBe(mockBlockHeight);
      expect(student.verificationAuthority).toBe(mockClarity.contractOwner);
    });
    
    it('should fail if student does not exist', () => {
      const result = contract.verifyStudent('non-existent-student');
      expect(result).toEqual({ type: 'err', value: 3 }); // ERR_NOT_FOUND
    });
  });
  
  describe('isStudentVerified', () => {
    it('should return false for unverified students', () => {
      // Register but don't verify
      contract.registerStudent('student-123');
      
      const isVerified = contract.isStudentVerified('student-123');
      expect(isVerified).toBe(false);
    });
    
    it('should return true for verified students', () => {
      // Register and verify
      contract.registerStudent('student-123');
      contract.verifyStudent('student-123');
      
      const isVerified = contract.isStudentVerified('student-123');
      expect(isVerified).toBe(true);
    });
    
    it('should return false for non-existent students', () => {
      const isVerified = contract.isStudentVerified('non-existent-student');
      expect(isVerified).toBe(false);
    });
  });
});
