import fs from 'fs';
import path from 'path';
import platformClient from 'purecloud-platform-client-v2';
import { fileURLToPath } from 'url';
import config from './config.json' assert { type: 'json' };

const client = platformClient.ApiClient.instance;
client.setEnvironment(platformClient.PureCloudRegionHosts.eu_west_1);

const clientId = config.GENESYS_CLIENT_ID;
const clientSecret = config.GENESYS_CLIENT_SECRET;

const isLambda = !!process.env.LAMBDA_TASK_ROOT;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokenFilePath = isLambda ? "/tmp/tokenData.json" : path.join(__dirname, 'tokenData.json');

async function obtenerToken() {
  try {
    const data = await client.loginClientCredentialsGrant(clientId, clientSecret);
    console.log("Nuevo token de acceso obtenido.");

    if (!isLambda) {
      fs.mkdirSync(path.dirname(tokenFilePath), { recursive: true });
    }

    fs.writeFileSync(tokenFilePath, JSON.stringify({
      accessToken: data.accessToken,
      expiryTime: Date.now() + (data.tokenExpiryTime - Date.now())
    }));

    return data.accessToken;
  } catch (error) {
    console.error("Error al obtener el token:", error);
    throw error;
  }
}

export async function actualizarTokenSiEsNecesario() {
  try {
    if (fs.existsSync(tokenFilePath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));

      if (tokenData.expiryTime > Date.now()) {
        console.log("Token válido reutilizado.");
        return tokenData.accessToken;
      }
    }
    return await obtenerToken();
  } catch (error) {
    console.error("Error al actualizar el token:", error);
    throw error;
  }
}
