// @ts-ignore
import fetch from 'node-fetch';
import { Product } from '@Types/product/Product';
import { ContextType } from '../interfaces/ContextType';
import BaseApi from './BaseApi';
import { DynamicYieldMapper } from '@Content-dynamicyield/mappers/DynamicYieldMapper';
import { ExternalError } from '@Content-dynamicyield/utils/Errors';

export default class DynamicYieldApi extends BaseApi {
  async choose(dyContext: ContextType, selectors: string[] = []): Promise<Product[]> {
    const userId = this.getUserId();
    const sessionId = this.getSessionId();
    const body = {
      selector: {
        names: selectors,
      },
      user: {
        id: userId,
      },
      session: {
        custom: sessionId,
      },
      context: dyContext,
    };
    const headers = {
      'dy-api-key': this.getDyClient().apiKey,
      'Content-Type': 'application/json',
    };

    const resultBody = await fetch(this.getDyClient().url, {
      method: 'post',
      body: JSON.stringify(body),
      headers,
    })
      .then((response: { json: () => never }) => response.json())
      .catch((error: { code: number; message: string; body: string }) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
    const stringifyResultBody = JSON.stringify(resultBody);
    return DynamicYieldMapper.mapChooseResponseToProducts(stringifyResultBody);
  }
}
