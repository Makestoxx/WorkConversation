import { handler } from './handler.mjs';

(async () => {
  try {
    const result = await handler({
      ID: "3f22c140-862f-4a92-9123-f2c51843a92f",
      Interaction_Type: "voice"
    });
    console.log('Resultado:', result);
  } catch (error) {
    console.error('Error general:', error);
  }
})();
