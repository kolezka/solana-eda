/**
 * Configuration decorators
 */

import { getConfigService } from './config.service';

/**
 * Property decorator for injecting configuration values
 */
export function Config(path?: string) {
  return function (target: any, propertyKey: string) {
    Object.defineProperty(target, propertyKey, {
      get() {
        const configService = getConfigService();
        return path ? configService.get(path) : configService.getConfig();
      },
      set(value: unknown) {
        // Configuration is read-only, but we'll allow setting for testing
        Object.defineProperty(target, `_${propertyKey}`, {
          value,
          writable: true,
          enumerable: true,
        });
      },
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Parameter decorator for injecting configuration values
 */
export function InjectConfig(path?: string) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingInjectedParameters = Reflect.getMetadata('config:parameters', target) || [];
    existingInjectedParameters.push({
      parameterIndex,
      path,
    });
    Reflect.defineMetadata('config:parameters', existingInjectedParameters, target);
  };
}

/**
 * Class decorator for enabling configuration injection
 */
export function InjectableConfig() {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        const configService = getConfigService();
        const injectedParameters: Array<{ parameterIndex: number; path?: string }> =
          Reflect.getMetadata('config:parameters', constructor.prototype) || [];

        const resolvedArgs = [...args];

        // Resolve injected parameters
        for (const { parameterIndex, path } of injectedParameters) {
          if (!resolvedArgs[parameterIndex]) {
            resolvedArgs[parameterIndex] = path
              ? configService.get(path)
              : configService.getConfig();
          }
        }

        super(...resolvedArgs);

        // Inject property decorators
        const propertyKeys = Object.getOwnPropertyNames(constructor.prototype);

        for (const key of propertyKeys) {
          const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, key);

          if (descriptor?.get && descriptor.get.toString().includes('getConfigService')) {
            // The property is already configured via the Config decorator
            Object.defineProperty(this, key, {
              get: descriptor.get.bind(this),
              enumerable: true,
            });
          }
        }
      }
    };
  };
}

/**
 * Environment-specific decorator
 */
export function Environment(...environments: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const configService = getConfigService();
    const currentEnvironment = configService.get('app.environment');

    descriptor.value = function (...args: any[]) {
      if (!environments.includes(currentEnvironment)) {
        return;
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Feature flag decorator
 */
export function FeatureFlag(feature: keyof import('./config.schema').AppConfig['workers']) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const configService = getConfigService();

    descriptor.value = function (...args: any[]) {
      if (!configService.isFeatureEnabled(feature)) {
        throw new Error(`Feature '${feature}' is not enabled`);
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
