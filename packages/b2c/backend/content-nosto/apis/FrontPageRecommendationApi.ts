import { Product } from '@Types/product/Product';
import { NostoMapper } from '../mappers/NostoMapper';
import BaseApi from './BaseApi';
import { NostoPageTypes } from '@Content-nosto/interfaces/NostoResponse';

export default class FrontPageRecommendationApi extends BaseApi {
  async fetchRecommendation(target: string, placementId: string): Promise<Product[]> {
    const sessionId = this.getSessionId();
    const body = `mutation {
      updateSession(by: BY_CID, id: "${sessionId}",
        params: {
          event: {
            type: VIEWED_PAGE
            target: "${target}"
          }
        }
      ) {
        pages {
          forFrontPage(params: {
            isPreview: false, imageVersion:  ${this.getQueryImageVersion()}
          }) ${this.getQueryFields()}
        }
      }
    }`;
    const recommendationResult = await this.fetch(body);
    const placementList = recommendationResult?.data?.updateSession?.pages?.[NostoPageTypes.FRONT];
    const recommendedProducts = placementList.filter((obj) => obj?.resultId == placementId)[0].primary;
    return NostoMapper.mapNostoResponseToProducts(recommendedProducts);
  }
}
