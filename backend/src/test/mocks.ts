/**
 * Creates a minimal in-memory TypeORM repository mock covering the subset
 * of Repository<T> used by the services under test. All methods are plain
 * jest.Mocks so individual specs can re-stub their behavior.
 */
function mockFn(impl?: (...args: any[]) => any): jest.Mock {
  return jest.fn(impl) as jest.Mock;
}

export function createMockRepository() {
  const store: any[] = [];

  return {
    store,
    create: mockFn((data?: any) => data ?? {}),
    save: mockFn(async (data: any) => ({ id: data.id ?? 'generated-id', ...data })),
    find: mockFn(async () => store),
    findOne: mockFn(async () => null),
    exists: mockFn(async () => false),
    update: mockFn(async () => undefined),
    remove: mockFn(async (entity: any) => entity),
    manager: {
      transaction: mockFn(async (callback: any) =>
        callback({
          update: mockFn(async () => undefined),
        }),
      ),
    },
  };
}

export function httpExceptionStatus(error: unknown): number | undefined {
  return (error as { status?: number })?.status;
}
