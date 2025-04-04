import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock clarity functions and blockchain state
const mockBlockHeight = 123456;
const mockTxSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const mockContractOwner = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
const mockInstitution = 'ST3AMFB2H39SSDK3WCAN78XF31WXNKH7YZBS7Q742';

// Mock data stores
let mockInstitutions = new Map();
let mockAchievements = new Map();

// Mock clarity functions
const mockClarity = {
  blockHeight: mockBlockHeight,
  txSender: mockTxSender,
  
  mapGet: (map, key) => {
    if (map === 'institutions') {
      return mockInstitutions.get(key.institutionId);
    } else if (map === 'achievements') {
      return mockAchievements.get(key.achievementId);
    }
    return undefined;
  },
  
  mapSet: (map, key, value) => {
    if (map === 'institutions') {
      mockInstitutions.set(key.institutionId, value);
      return true;
    } else if (map === 'achievements') {
      mockAchievements.set(key.achievementId, value);
      return true;
    }
    return false;
  },
  
  contractOwner: mockContractOwner
};

// Import the contract functions (mocked implementation)
const contract = {
  getInstitutionInfo: (institutionId) => {
    return mockClarity.mapGet('institutions', { institutionId });
  },
  
  getAchievement: (achievementId) => {
    return mockClarity.mapGet('achievements', { achievementId });
  },
  
  isInstitutionVerified: (institutionId) => {
    const institution = mockClarity.mapGet('institutions', { institutionId });
    return institution ? institution.verified : false;
  },
  
  registerInstitution: (institutionId, name) => {
    const existingInstitution = mockClarity.mapGet('institutions', { institutionId });
    if (existingInstitution) {
      return { type: 'err', value: 2 }; // ERR_ALREADY_EXISTS
    }
    
    mockClarity.mapSet('institutions', { institutionId }, {
      principal: mockClarity.txSender,
      name,
      verified: false
    });
    
    return { type: 'ok', value: true };
  },
  
  verifyInstitution: (institutionId) => {
    // Only contract owner can verify institutions
    if (mockClarity.txSender !== mockClarity.contractOwner) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    const institutionRecord = mockClarity.mapGet('institutions', { institutionId });
    if (!institutionRecord) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    mockClarity.mapSet('institutions', { institutionId }, {
      ...institutionRecord,
      verified: true
    });
    
    return { type: 'ok', value: true };
  },
  
  issueAchievement: (achievementId, studentId, institutionId, achievementType, name, description, metadataUrl) => {
    // Check if achievement already exists
    const existingAchievement = mockClarity.mapGet('achievements', { achievementId });
    if (existingAchievement) {
      return { type: 'err', value: 2 }; // ERR_ALREADY_EXISTS
    }
    
    // Check if institution exists and is verified
    const institutionRecord = mockClarity.mapGet('institutions', { institutionId });
    if (!institutionRecord) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    if (!institutionRecord.verified) {
      return { type: 'err', value: 4 }; // ERR_INVALID_INSTITUTION
    }
    
    // Check if issuer is the institution
    if (mockClarity.txSender !== institutionRecord.principal) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    mockClarity.mapSet('achievements', { achievementId }, {
      studentId,
      institutionId,
      achievementType,
      name,
      description,
      issueDate: mockClarity.blockHeight,
      metadataUrl,
      revoked: false
    });
    
    return { type: 'ok', value: true };
  },
  
  revokeAchievement: (achievementId) => {
    const achievementRecord = mockClarity.mapGet('achievements', { achievementId });
    if (!achievementRecord) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    const institutionId = achievementRecord.institutionId;
    const institutionRecord = mockClarity.mapGet('institutions', { institutionId });
    
    if (!institutionRecord) {
      return { type: 'err', value: 3 }; // ERR_NOT_FOUND
    }
    
    // Check if issuer is the institution
    if (mockClarity.txSender !== institutionRecord.principal) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    mockClarity.mapSet('achievements', { achievementId }, {
      ...achievementRecord,
      revoked: true
    });
    
    return { type: 'ok', value: true };
  }
};

describe('Achievement Certification Contract', () => {
  beforeEach(() => {
    // Reset mock data before each test
    mockInstitutions.clear();
    mockAchievements.clear();
    
    // Set up a verified institution for testing
    mockInstitutions.set('inst-123', {
      principal: mockInstitution,
      name: 'Test University',
      verified: true
    });
  });
  
  describe('registerInstitution', () => {
    it('should register a new institution successfully', () => {
      const result = contract.registerInstitution('inst-456', 'New University');
      expect(result).toEqual({ type: 'ok', value: true });
      
      const institution = contract.getInstitutionInfo('inst-456');
      expect(institution).toBeDefined();
      expect(institution.name).toBe('New University');
      expect(institution.verified).toBe(false);
    });
    
    it('should fail if institution is already registered', () => {
      // Register once
      contract.registerInstitution('inst-456', 'New University');
      
      // Try to register again
      const result = contract.registerInstitution('inst-456', 'Another University');
      expect(result).toEqual({ type: 'err', value: 2 }); // ERR_ALREADY_EXISTS
    });
  });
  
  describe('verifyInstitution', () => {
    beforeEach(() => {
      // Set tx-sender to contract owner for these tests
      mockClarity.txSender = mockContractOwner;
    });
    
    it('should verify an institution successfully', () => {
      // Register an institution first
      mockClarity.txSender = mockTxSender;
      contract.registerInstitution('inst-456', 'New University');
      
      // Verify the institution
      mockClarity.txSender = mockContractOwner;
      const result = contract.verifyInstitution('inst-456');
      expect(result).toEqual({ type: 'ok', value: true });
      
      const institution = contract.getInstitutionInfo('inst-456');
      expect(institution.verified).toBe(true);
    });
    
    it('should fail if institution does not exist', () => {
      const result = contract.verifyInstitution('non-existent-institution');
      expect(result).toEqual({ type: 'err', value: 3 }); // ERR_NOT_FOUND
    });
  });
  
  describe('issueAchievement', () => {
    beforeEach(() => {
      // Set tx-sender to the institution for these tests
      mockClarity.txSender = mockInstitution;
    });
    
    it('should issue an achievement successfully', () => {
      const result = contract.issueAchievement(
          'achievement-123',
          'student-123',
          'inst-123',
          'degree',
          'Bachelor of Science',
          'Computer Science degree',
          null
      );
      
      expect(result).toEqual({ type: 'ok', value: true });
      
      const achievement = contract.getAchievement('achievement-123');
      expect(achievement).toBeDefined();
      expect(achievement.name).toBe('Bachelor of Science');
      expect(achievement.revoked).toBe(false);
    });
    
    it('should fail if achievement already exists', () => {
      // Issue achievement once
      contract.issueAchievement(
          'achievement-123',
          'student-123',
          'inst-123',
          'degree',
          'Bachelor of Science',
          'Computer Science degree',
          null
      );
      
      // Try to issue again with same ID
      const result = contract.issueAchievement(
          'achievement-123',
          'student-456',
          'inst-123',
          'degree',
          'Another Degree',
          'Description',
          null
      );
      
      expect(result).toEqual({ type: 'err', value: 2 }); // ERR_ALREADY_EXISTS
    });
  });
  
  describe('revokeAchievement', () => {
    beforeEach(() => {
      // Set tx-sender to the institution for these tests
      mockClarity.txSender = mockInstitution;
      
      // Create an achievement to revoke
      contract.issueAchievement(
          'achievement-123',
          'student-123',
          'inst-123',
          'degree',
          'Bachelor of Science',
          'Computer Science degree',
          null
      );
    });
    
    it('should revoke an achievement successfully', () => {
      const result = contract.revokeAchievement('achievement-123');
      expect(result).toEqual({ type: 'ok', value: true });
      
      const achievement = contract.getAchievement('achievement-123');
      expect(achievement.revoked).toBe(true);
    });
    
    it('should fail if achievement does not exist', () => {
      const result = contract.revokeAchievement('non-existent-achievement');
      expect(result).toEqual({ type: 'err', value: 3 }); // ERR_NOT_FOUND
    });
  });
});
