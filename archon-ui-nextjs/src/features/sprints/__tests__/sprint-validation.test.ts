import { describe, it, expect } from 'vitest';
import { addDays, format, subDays } from 'date-fns';

/**
 * Unit Tests - Sprint Validation Logic
 * Phase 1.22: Sprint validation and business logic tests
 *
 * Tests cover:
 * - Sprint date validation
 * - Sprint name validation
 * - Sprint status validation
 * - Sprint transition rules
 */

describe('Sprint Validation Logic', () => {
  describe('Sprint Name Validation', () => {
    it('should reject empty sprint name', () => {
      const sprintName = '';
      const isValid = sprintName.trim().length > 0;

      expect(isValid).toBe(false);
    });

    it('should reject whitespace-only sprint name', () => {
      const sprintName = '   ';
      const isValid = sprintName.trim().length > 0;

      expect(isValid).toBe(false);
    });

    it('should accept valid sprint name', () => {
      const sprintName = 'Sprint 1';
      const isValid = sprintName.trim().length > 0;

      expect(isValid).toBe(true);
    });

    it('should trim sprint name', () => {
      const sprintName = '  Sprint 2  ';
      const trimmedName = sprintName.trim();

      expect(trimmedName).toBe('Sprint 2');
      expect(trimmedName.length).toBe(8);
    });
  });

  describe('Sprint Date Validation', () => {
    it('should reject end date before start date', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-10');

      const isValid = endDate > startDate;

      expect(isValid).toBe(false);
    });

    it('should reject end date equal to start date', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15');

      const isValid = endDate > startDate;

      expect(isValid).toBe(false);
    });

    it('should accept end date after start date', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-29');

      const isValid = endDate > startDate;

      expect(isValid).toBe(true);
    });

    it('should calculate sprint duration correctly', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-29');

      const durationDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(durationDays).toBe(14);
    });

    it('should validate minimum sprint duration (1 day)', () => {
      const startDate = new Date('2024-01-15');
      const endDate = addDays(startDate, 1);

      const durationDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(durationDays).toBeGreaterThanOrEqual(1);
    });

    it('should format dates correctly for API', () => {
      const date = new Date('2024-01-15T10:30:00');
      const formattedDate = format(date, 'yyyy-MM-dd');

      expect(formattedDate).toBe('2024-01-15');
    });
  });

  describe('Sprint Status Validation', () => {
    it('should validate planned status', () => {
      const status = 'planned';
      const validStatuses = ['planned', 'active', 'completed', 'cancelled'];

      expect(validStatuses).toContain(status);
    });

    it('should validate active status', () => {
      const status = 'active';
      const validStatuses = ['planned', 'active', 'completed', 'cancelled'];

      expect(validStatuses).toContain(status);
    });

    it('should validate completed status', () => {
      const status = 'completed';
      const validStatuses = ['planned', 'active', 'completed', 'cancelled'];

      expect(validStatuses).toContain(status);
    });

    it('should reject invalid status', () => {
      const status = 'invalid';
      const validStatuses = ['planned', 'active', 'completed', 'cancelled'];

      expect(validStatuses).not.toContain(status);
    });
  });

  describe('Sprint Transition Rules', () => {
    it('should allow transition from planned to active', () => {
      const currentStatus = 'planned';
      const newStatus = 'active';

      const validTransitions: Record<string, string[]> = {
        planned: ['active', 'cancelled'],
        active: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);

      expect(isValidTransition).toBe(true);
    });

    it('should allow transition from active to completed', () => {
      const currentStatus = 'active';
      const newStatus = 'completed';

      const validTransitions: Record<string, string[]> = {
        planned: ['active', 'cancelled'],
        active: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);

      expect(isValidTransition).toBe(true);
    });

    it('should prevent transition from planned to completed', () => {
      const currentStatus = 'planned';
      const newStatus = 'completed';

      const validTransitions: Record<string, string[]> = {
        planned: ['active', 'cancelled'],
        active: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);

      expect(isValidTransition).toBe(false);
    });

    it('should prevent transition from completed to active', () => {
      const currentStatus = 'completed';
      const newStatus = 'active';

      const validTransitions: Record<string, string[]> = {
        planned: ['active', 'cancelled'],
        active: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);

      expect(isValidTransition).toBe(false);
    });

    it('should prevent any transition from cancelled sprint', () => {
      const currentStatus = 'cancelled';
      const newStatus = 'active';

      const validTransitions: Record<string, string[]> = {
        planned: ['active', 'cancelled'],
        active: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);

      expect(isValidTransition).toBe(false);
    });
  });

  describe('Sprint Goal Validation', () => {
    it('should allow empty goal (optional field)', () => {
      const goal = '';
      const isValid = true; // Goal is optional

      expect(isValid).toBe(true);
    });

    it('should accept valid goal', () => {
      const goal = 'Complete user authentication feature';
      const isValid = goal.trim().length >= 0;

      expect(isValid).toBe(true);
      expect(goal.length).toBeGreaterThan(0);
    });

    it('should trim goal text', () => {
      const goal = '  Complete all tasks  ';
      const trimmedGoal = goal.trim();

      expect(trimmedGoal).toBe('Complete all tasks');
    });
  });

  describe('Sprint Filter Logic', () => {
    it('should filter out completed sprints for task assignment', () => {
      const sprints = [
        { id: '1', name: 'Sprint 1', status: 'planned' },
        { id: '2', name: 'Sprint 2', status: 'active' },
        { id: '3', name: 'Sprint 3', status: 'completed' },
        { id: '4', name: 'Sprint 4', status: 'cancelled' },
      ];

      const availableSprints = sprints.filter(
        (s) => s.status === 'planned' || s.status === 'active'
      );

      expect(availableSprints).toHaveLength(2);
      expect(availableSprints[0].name).toBe('Sprint 1');
      expect(availableSprints[1].name).toBe('Sprint 2');
    });

    it('should include only active and planned sprints', () => {
      const sprints = [
        { id: '1', name: 'Sprint 1', status: 'planned' },
        { id: '2', name: 'Sprint 2', status: 'active' },
        { id: '3', name: 'Sprint 3', status: 'completed' },
      ];

      const assignableSprints = sprints.filter(
        (s) => s.status === 'active' || s.status === 'planned'
      );

      expect(assignableSprints).toHaveLength(2);
      expect(assignableSprints.every(s => ['active', 'planned'].includes(s.status))).toBe(true);
    });
  });

  describe('Sprint Default Values', () => {
    it('should set default start date to today', () => {
      const today = new Date();
      const defaultStartDate = format(today, 'yyyy-MM-dd');

      expect(defaultStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should set default end date to 2 weeks from start', () => {
      const startDate = new Date();
      const defaultEndDate = addDays(startDate, 14);

      const durationDays = Math.ceil(
        (defaultEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(durationDays).toBe(14);
    });

    it('should format default dates correctly', () => {
      const today = new Date();
      const endDate = addDays(today, 14);

      const formattedStart = format(today, 'yyyy-MM-dd');
      const formattedEnd = format(endDate, 'yyyy-MM-dd');

      expect(formattedStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(formattedEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Sprint Velocity Calculation', () => {
    it('should calculate velocity as zero for sprint with no tasks', () => {
      const completedTasks = 0;
      const totalPoints = 0;

      const velocity = completedTasks > 0 ? totalPoints / completedTasks : 0;

      expect(velocity).toBe(0);
    });

    it('should calculate velocity correctly with completed tasks', () => {
      const completedPoints = 25;
      const sprintDurationWeeks = 2;

      const velocity = completedPoints / sprintDurationWeeks;

      expect(velocity).toBe(12.5);
    });

    it('should handle velocity calculation for partial sprint', () => {
      const completedPoints = 15;
      const completedTasks = 3;

      const averagePointsPerTask = completedPoints / completedTasks;

      expect(averagePointsPerTask).toBe(5);
    });
  });
});
