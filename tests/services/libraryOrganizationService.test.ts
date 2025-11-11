import { describe, it, expect, beforeEach, vi } from 'vitest';

const { rpcMock, supabaseFromMock, createErrorMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  createErrorMock: vi.fn((message: string) => new Error(message))
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: supabaseFromMock
  },
  userBooks: {},
  userNotes: {},
  userAudio: {}
}));

vi.mock('../../src/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../src/services/errorHandler', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/errorHandler')>(
    '../../src/services/errorHandler'
  );
  return {
    ...actual,
    errorHandler: {
      ...actual.errorHandler,
      createError: createErrorMock
    }
  };
});

import { libraryOrganizationService } from '../../src/services/libraryOrganizationService';

describe('libraryOrganizationService (sidebar integrations)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    supabaseFromMock.mockReset();
    createErrorMock.mockClear();
    libraryOrganizationService.setCurrentUser('user-123');
  });

  describe('reorderCollections', () => {
    it('calls Supabase RPC with user context', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        libraryOrganizationService.reorderCollections('parent-1', ['col-1', 'col-2'])
      ).resolves.toBeUndefined();

      expect(rpcMock).toHaveBeenCalledWith('reorder_user_collections', {
        user_uuid: 'user-123',
        parent_uuid: 'parent-1',
        ordered_ids: ['col-1', 'col-2']
      });
    });

    it('wraps Supabase errors via error handler', async () => {
      const failure = { message: 'something went wrong' };
      rpcMock.mockResolvedValueOnce({ data: null, error: failure as any });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.reorderCollections('parent-1', ['col-1'])
      ).rejects.toThrow('Failed to reorder collections: something went wrong');

      expect(createErrorMock).toHaveBeenCalledWith(
        'Failed to reorder collections: something went wrong',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          context: 'reorderCollections',
          parentId: 'parent-1',
          orderedIds: ['col-1'],
          error: 'something went wrong'
        })
      );
    });
  });

  describe('bulkAddToCollection', () => {
    it('delegates to transactional Supabase RPC', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        libraryOrganizationService.bulkAddToCollection(['book-1', 'book-2'], 'collection-1')
      ).resolves.toBeUndefined();

      expect(rpcMock).toHaveBeenCalledWith('bulk_assign_books_to_collection', {
        user_uuid: 'user-123',
        collection_uuid: 'collection-1',
        book_ids: ['book-1', 'book-2']
      });
    });

    it('raises formatted error when Supabase rejects request', async () => {
      const failure = { message: 'duplicate key value violates unique constraint' };
      rpcMock.mockResolvedValueOnce({ data: null, error: failure as any });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.bulkAddToCollection(['book-5'], 'collection-9')
      ).rejects.toThrow('Failed to bulk add books to collection: duplicate key value violates unique constraint');

      expect(createErrorMock).toHaveBeenCalledWith(
        'Failed to bulk add books to collection: duplicate key value violates unique constraint',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          context: 'bulkAddToCollection',
          bookIds: ['book-5'],
          collectionId: 'collection-9',
          error: 'duplicate key value violates unique constraint'
        })
      );
    });
  });

  describe('batchAddTags', () => {
    it('upserts assignments via Supabase', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      supabaseFromMock.mockReturnValueOnce({ upsert: upsertMock });

      await expect(
        libraryOrganizationService.batchAddTags(['book-1'], ['tag-1', 'tag-2'])
      ).resolves.toBeUndefined();

      expect(supabaseFromMock).toHaveBeenCalledWith('book_tag_assignments');
      expect(upsertMock).toHaveBeenCalledWith(
        [
          { book_id: 'book-1', tag_id: 'tag-1' },
          { book_id: 'book-1', tag_id: 'tag-2' }
        ],
        { onConflict: 'book_id,tag_id' }
      );
    });

    it('wraps Supabase errors when upsert fails', async () => {
      const failure = { message: 'db error' };
      const upsertMock = vi.fn().mockResolvedValue({ error: failure as any });
      supabaseFromMock.mockReturnValueOnce({ upsert: upsertMock });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.batchAddTags(['book-1'], ['tag-1'])
      ).rejects.toThrow('Failed to batch add tags: db error');

      expect(createErrorMock).toHaveBeenCalledWith(
        'Failed to batch add tags: db error',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          context: 'batchAddTags',
          bookIds: ['book-1'],
          tagIds: ['tag-1'],
          error: 'db error'
        })
      );
    });
  });

  describe('batchRemoveTags', () => {
    it('returns early when no tag assignments provided', async () => {
      await expect(
        libraryOrganizationService.batchRemoveTags([], ['tag-1'])
      ).resolves.toBeUndefined();
      expect(supabaseFromMock).not.toHaveBeenCalled();
    });

    it('deletes assignments via Supabase', async () => {
      const finalInMock = vi.fn().mockResolvedValue({ error: null });
      const firstInMock = vi.fn(() => ({ in: finalInMock }));
      const deleteMock = vi.fn(() => ({ in: firstInMock }));
      supabaseFromMock.mockReturnValueOnce({ delete: deleteMock });

      await expect(
        libraryOrganizationService.batchRemoveTags(['book-1'], ['tag-1', 'tag-2'])
      ).resolves.toBeUndefined();

      expect(supabaseFromMock).toHaveBeenCalledWith('book_tag_assignments');
      expect(deleteMock).toHaveBeenCalled();
      expect(firstInMock).toHaveBeenCalledWith('book_id', ['book-1']);
      expect(finalInMock).toHaveBeenCalledWith('tag_id', ['tag-1', 'tag-2']);
    });

    it('wraps errors from Supabase delete chain', async () => {
      const failure = { message: 'db error' };
      const finalInMock = vi.fn().mockResolvedValue({ error: failure as any });
      const firstInMock = vi.fn(() => ({ in: finalInMock }));
      const deleteMock = vi.fn(() => ({ in: firstInMock }));
      supabaseFromMock.mockReturnValueOnce({ delete: deleteMock });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.batchRemoveTags(['book-1'], ['tag-1'])
      ).rejects.toThrow('Failed to batch remove tags: db error');

      expect(createErrorMock).toHaveBeenCalledWith(
        'Failed to batch remove tags: db error',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          context: 'batchRemoveTags',
          bookIds: ['book-1'],
          tagIds: ['tag-1'],
          error: 'db error'
        })
      );
    });
  });

  describe('moveCollection', () => {
    it('updates parent id through Supabase', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null });
      const eqUserMock = vi.fn().mockResolvedValue({ error: null });
      const eqIdMock = vi.fn(() => ({ eq: eqUserMock }));
      const updateMock = vi.fn(() => ({ eq: eqIdMock }));
      supabaseFromMock.mockReturnValueOnce({ update: updateMock });

      await expect(
        libraryOrganizationService.moveCollection('col-1', 'parent-2')
      ).resolves.toBeUndefined();

      expect(rpcMock).toHaveBeenCalledWith('get_collection_hierarchy', {
        user_uuid: 'user-123',
        root_id: 'col-1'
      });
      expect(supabaseFromMock).toHaveBeenCalledWith('user_collections');
      expect(updateMock).toHaveBeenCalledWith({ parent_id: 'parent-2' });
      expect(eqIdMock).toHaveBeenCalledWith('id', 'col-1');
      expect(eqUserMock).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('prevents moving a collection into its descendant', async () => {
      rpcMock.mockResolvedValueOnce({ data: [{ id: 'parent-2' }], error: null });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.moveCollection('col-1', 'parent-2')
      ).rejects.toThrow('Cannot move collection into its own subcollection');

      expect(supabaseFromMock).not.toHaveBeenCalled();
    });

    it('wraps Supabase update errors', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null });
      const eqUserMock = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
      const eqIdMock = vi.fn(() => ({ eq: eqUserMock }));
      const updateMock = vi.fn(() => ({ eq: eqIdMock }));
      supabaseFromMock.mockReturnValueOnce({ update: updateMock });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.moveCollection('col-1', 'parent-9')
      ).rejects.toThrow('Failed to move collection: db error');

      expect(createErrorMock).toHaveBeenCalledWith(
        'Failed to move collection: db error',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          context: 'moveCollection',
          collectionId: 'col-1',
          error: 'db error'
        })
      );
    });
  });
});

