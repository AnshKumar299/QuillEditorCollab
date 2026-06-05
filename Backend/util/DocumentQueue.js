export class DocumentQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  enqueue(task) {
    const result = this.queue.then(task);
    this.queue = result.catch(() => {});
    return result;
  }
}
