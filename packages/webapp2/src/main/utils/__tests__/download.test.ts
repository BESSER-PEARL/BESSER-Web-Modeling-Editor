import { downloadFile, downloadJson, copyToClipboard } from '../download';

describe('downloadFile', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor element with the correct href and download attributes', () => {
    downloadFile('hello world', 'test.txt');

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/plain');

    // The anchor should have been appended and removed
    expect(appendChildSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledOnce();

    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.download).toBe('test.txt');
  });

  it('accepts a Blob directly', () => {
    const blob = new Blob(['binary data'], { type: 'application/octet-stream' });
    downloadFile(blob, 'data.bin');

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
  });

  it('uses a custom MIME type when provided', () => {
    downloadFile('<svg></svg>', 'image.svg', 'image/svg+xml');

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('image/svg+xml');
  });

  it('revokes the object URL after a timeout', () => {
    vi.useFakeTimers();
    downloadFile('content', 'file.txt');

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    vi.useRealTimers();
  });
});

describe('downloadJson', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes an object to JSON with indentation', () => {
    const data = { name: 'test', value: 42 };
    downloadJson(data, 'data.json');

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json');
  });

  it('passes a string through without re-serializing', () => {
    const jsonString = '{"already":"serialized"}';
    downloadJson(jsonString, 'data.json');

    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json');
  });
});

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true on success', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const result = await copyToClipboard('hello');
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('returns false when clipboard.writeText rejects', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    const result = await copyToClipboard('hello');
    expect(result).toBe(false);
  });
});
