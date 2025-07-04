import { DataSourcePreviewPayloadElement } from '@frontastic/extension-types/src/ts';
import {
  DataSourceConfiguration,
  DataSourceContext,
  DynamicPageContext,
  DynamicPageRedirectResult,
  DynamicPageSuccessResult,
  ExtensionRegistry,
  Request,
} from '@frontastic/extension-types';
import { Product } from '@Types/product/Product';
import { ProductPaginatedResult } from '@Types/result';
import { Attributes } from '@Types/product';
import * as AccountActions from './actionControllers/AccountController';
import * as ProductActions from './actionControllers/ProductController';
import * as CartActions from './actionControllers/CartController';
import * as WishlistActions from './actionControllers/WishlistController';
import * as ProjectActions from './actionControllers/ProjectController';
import { getCurrency, getLocale, getPath } from './utils/Request';
import { ProductRouter } from './utils/routers/ProductRouter';
import { SearchRouter } from './utils/routers/SearchRouter';
import { CategoryRouter } from './utils/routers/CategoryRouter';
import { ProductApi } from './apis/ProductApi';
import { ProductQueryFactory } from './utils/ProductQueryFactory';
import { ValidationError } from '@Commerce-commercetools/errors/ValidationError';
import handleError from '@Commerce-commercetools/utils/handleError';

const getPreviewPayload = (queryResult: ProductPaginatedResult) => {
  return queryResult.items.map((product): DataSourcePreviewPayloadElement => {
    return {
      title: product.name,
      image: product?.variants[0]?.images[0],
    };
  });
};

// Master data source is only available in the context of a dynamic page
const findDynamicPageMasterDataSource = (context: DataSourceContext, dataSourceType: string) => {
  return context.pageFolder.dataSourceConfigurations.find(
    (dataSource) => dataSource.dataSourceId === '__master' && dataSource.type === dataSourceType,
  );
};

export default {
  'dynamic-page-handler': async (
    request: Request,
    context: DynamicPageContext,
  ): Promise<DynamicPageSuccessResult | DynamicPageRedirectResult | null> => {
    // Identify static page
    try {
      const staticPageMatch = getPath(request)?.match(
        /^\/(cart|checkout|wishlist|account|login|register|reset-password|thank-you)$/,
      );
      if (staticPageMatch) {
        return {
          dynamicPageType: `frontastic${staticPageMatch[0]}`,
          dataSourcePayload: {},
        } as DynamicPageSuccessResult;
      }

      // Identify Product
      if (ProductRouter.identifyFrom(request)) {
        return ProductRouter.loadFor(request, context.frontasticContext).then((product: Product) => {
          if (!product) {
            return null;
          }

          const sku = ProductRouter.skuFromUrl(request);
          const matchingAttributes: Attributes = {};

          if (sku) {
            const selectedVariant = product.variants.find((variant) => variant.sku === sku);
            if (selectedVariant.attributes) {
              Object.entries(selectedVariant.attributes).forEach(([key, value]) => {
                // FECL can't match rules on arrays, so we ignore array attributes
                if (!Array.isArray(value)) {
                  matchingAttributes[key] = value?.key ?? value;
                }
              });
            }
          }

          return {
            dynamicPageType: 'frontastic/product-detail-page',
            dataSourcePayload: {
              product: product,
            },
            pageMatchingPayload: {
              productTypeId: product.productTypeId || '',
              variants: {
                attributes: matchingAttributes,
              },
              categoryRef: product.categories?.map((category) => category.categoryRef),
            },
          };
        });
      }

      // Identify Search
      if (SearchRouter.identifyFrom(request)) {
        return SearchRouter.loadFor(request, context.frontasticContext).then((result: ProductPaginatedResult) => {
          if (result) {
            return {
              dynamicPageType: 'frontastic/search',
              dataSourcePayload: result,
            };
          }
          return null;
        });
      }

      // Identify Category
      if (CategoryRouter.identifyFrom(request)) {
        return CategoryRouter.loadFor(request, context.frontasticContext).then((category) => {
          if (!category) {
            return null;
          }

          return CategoryRouter.loadProductsFor(request, context.frontasticContext, category).then((result) => {
            if (!result) {
              return null;
            }

            return {
              dynamicPageType: 'frontastic/category',
              dataSourcePayload: result,
              pageMatchingPayload: {
                categoryRef: category.categoryRef,
                isMainCategory: category.parentId === undefined,
              },
            };
          });
        });
      }

      return null;
    } catch (error) {
      if (context.frontasticContext.environment !== 'production') {
        return {
          dynamicPageType: 'frontastic/error',
          dataSourcePayload: handleError(error, request),
        };
      }
      return null;
    }
  },
  'data-sources': {
    'frontastic/product-list': async (config: DataSourceConfiguration, context: DataSourceContext) => {
      try {
        const productApi = new ProductApi(
          context.frontasticContext,
          getLocale(context.request),
          getCurrency(context.request),
          context.request,
        );
        const productQuery = ProductQueryFactory.queryFromParams(context?.request, config);

        const queryResult = await productApi.query(productQuery);

        return !context.isPreview
          ? { dataSourcePayload: queryResult }
          : {
              dataSourcePayload: queryResult,
              previewPayload: getPreviewPayload(queryResult),
            };
      } catch (error) {
        return {
          dataSourcePayload: handleError(error, context.request),
        };
      }
    },

    'frontastic/similar-products': async (config: DataSourceConfiguration, context: DataSourceContext) => {
      try {
        if (!context.hasOwnProperty('request')) {
          throw new ValidationError({
            message: `Request is not defined in context ${context}`,
          });
        }

        const masterDataSource = findDynamicPageMasterDataSource(context, 'frontastic/product');

        if (!masterDataSource) {
          return {
            dataSourcePayload: {},
            previewPayload: [],
          };
        }

        const productApi = new ProductApi(
          context.frontasticContext,
          getLocale(context.request),
          getCurrency(context.request),
          context.request,
        );
        const productQuery = ProductQueryFactory.queryFromParams(context.request, config);

        const masterProduct = masterDataSource.preloadedValue?.product as Product;

        const masterProductCategories = masterProduct ? [masterProduct.categories?.[0]?.categoryId] : [];

        const query = {
          ...productQuery,
          categories: masterProductCategories,
        };

        const queryResult = await productApi.query(query);

        return !context.isPreview
          ? { dataSourcePayload: queryResult }
          : {
              dataSourcePayload: queryResult,
              previewPayload: getPreviewPayload(queryResult),
            };
      } catch (error) {
        return {
          dataSourcePayload: handleError(error, context.request),
        };
      }
    },

    'frontastic/product': async (config: DataSourceConfiguration, context: DataSourceContext) => {
      try {
        const productApi = new ProductApi(
          context.frontasticContext,
          getLocale(context.request),
          getCurrency(context.request),
          context.request,
        );
        const productQuery = ProductQueryFactory.queryFromParams(context?.request, config);

        const queryResult = await productApi.getProduct(productQuery);
        const payLoadResult = { dataSourcePayload: { product: queryResult } };

        return !context.isPreview
          ? payLoadResult
          : {
              payLoadResult,
              previewPayload: [
                {
                  title: queryResult.name,
                  image: queryResult?.variants[0]?.images[0],
                },
              ],
            };
      } catch (error) {
        return {
          dataSourcePayload: handleError(error, context.request),
        };
      }
    },

    'frontastic/other-products': async (config: DataSourceConfiguration, context: DataSourceContext) => {
      if (!context.hasOwnProperty('request')) {
        throw new ValidationError({
          message: `Request is not defined in context ${context}`,
        });
      }

      try {
        const productApi = new ProductApi(
          context.frontasticContext,
          getLocale(context.request),
          getCurrency(context.request),
          context.request,
        );
        const productQuery = ProductQueryFactory.queryFromParams(context.request, config);

        const shuffleArray = <T>(array: T[]): T[] => {
          for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
          }
          return array;
        };

        const queryResult = await productApi.query(productQuery);

        return {
          dataSourcePayload: {
            ...queryResult,
            items: shuffleArray(queryResult.items),
          },
        };
      } catch (error) {
        return {
          dataSourcePayload: handleError(error, context.request),
        };
      }
    },

    'frontastic/referenced-products': async (config: DataSourceConfiguration, context: DataSourceContext) => {
      try {
        if (!context.hasOwnProperty('request')) {
          throw new ValidationError({
            message: `Request is not defined in context ${context}`,
          });
        }

        const masterDataSource = findDynamicPageMasterDataSource(context, 'frontastic/product');

        const referencedProductsIdField = config?.configuration?.referencedProductsIdField;

        if (!masterDataSource || !referencedProductsIdField) {
          return {
            dataSourcePayload: {},
            previewPayload: [],
          };
        }

        const masterProduct = masterDataSource.preloadedValue?.product as Product;

        const masterProductReferencedProductIds = masterProduct.variants?.[0]?.attributes?.[referencedProductsIdField];

        context.request.query['productIds'] = masterProductReferencedProductIds ?? [];

        const productApi = new ProductApi(
          context.frontasticContext,
          getLocale(context.request),
          getCurrency(context.request),
          context.request,
        );

        const productQuery = ProductQueryFactory.queryFromParams(context.request, config);

        const queryResult = await productApi.query(productQuery);

        return !context.isPreview
          ? { dataSourcePayload: queryResult }
          : {
              dataSourcePayload: queryResult,
              previewPayload: getPreviewPayload(queryResult),
            };
      } catch (error) {
        return {
          dataSourcePayload: handleError(error, context.request),
        };
      }
    },

    'frontastic/empty': async (config: DataSourceConfiguration, context: DataSourceContext) => {
      return !context.isPreview
        ? { dataSourcePayload: {} }
        : {
            dataSourcePayload: {},
            previewPayload: [],
          };
    },
  },
  actions: {
    account: AccountActions,
    cart: CartActions,
    product: ProductActions,
    wishlist: WishlistActions,
    project: ProjectActions,
  },
} as ExtensionRegistry;
