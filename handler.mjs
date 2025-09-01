import { actualizarTokenSiEsNecesario } from './tokenService.mjs';
import { processInteraction } from './processConversations.mjs';

export async function handler(event = {}) {
  try {
    const { ID, Interaction_Type } = event;

    if (!ID) throw new Error('Falta el parámetro ID.');
    if (!Interaction_Type) throw new Error('Falta el parámetro Interaction_Type.');

    const token = await actualizarTokenSiEsNecesario();
    const resultado = await processInteraction(token, ID, Interaction_Type);

    return {
      statusCode: 200,
      body: resultado
    };

  } catch (error) {
    console.error('HANDLER_ERROR', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'Error interno' })
    };
  }
}

