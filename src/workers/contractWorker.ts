import * as ort from 'onnxruntime-web';

let session: ort.InferenceSession | null = null;

async function getSession() {
  if (!session) {
    session = await ort.InferenceSession.create('/models/contract.onnx');
  }
  return session;
}

interface InferData {
  amount: number;
  periodicity: string;
  recipient: string;
}

interface InferMessage {
  type: 'infer';
  data: InferData;
}

self.onmessage = async (event: MessageEvent<InferMessage>) => {
  const { type, data } = event.data;
  if (type === 'infer') {
    const sess = await getSession();
    const amount = data.amount ?? 0;
    const input = new ort.Tensor('float32', Float32Array.from([amount]), [1, 1]);
    const feeds: Record<string, ort.Tensor> = { [sess.inputNames[0]]: input };
    const results = await sess.run(feeds);
    const outputName = sess.outputNames[0];
    const output = results[outputName];
    self.postMessage({ type: 'result', data: output });
  }
};
