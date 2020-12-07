import * as cdk from '@aws-cdk/core';
import { CfnRoute } from './appmesh.generated';
import { Protocol } from './shared-interfaces';
import { IVirtualNode } from './virtual-node';

/**
 * Properties for the Weighted Targets in the route
 */
export interface WeightedTarget {
  /**
   * The VirtualNode the route points to
   */
  readonly virtualNode: IVirtualNode;

  /**
   * The weight for the target
   *
   * @default 1
   */
  readonly weight?: number;
}

/**
 * The criterion for determining a request match for this GatewayRoute
 */
export interface HttpRouteMatch {
  /**
   * Specifies the path to match requests with.
   * This parameter must always start with /, which by itself matches all requests to the virtual service name.
   * You can also match for path-based routing of requests. For example, if your virtual service name is my-service.local
   * and you want the route to match requests to my-service.local/metrics, your prefix should be /metrics.
   */
  readonly prefixPath: string;
}

/**
 * The criterion for determining a request match for this GatewayRoute
 */
export interface GrpcRouteMatch {
  /**
   * The fully qualified domain name for the service to match from the request
   */
  readonly serviceName: string;
}

/**
 * Properties specific for HTTP Based Routes
 */
export interface HttpRouteSpecOptions {
  /**
   * The criterion for determining a request match for this Route
   *
   * @default - matches on '/'
   */
  readonly match?: HttpRouteMatch;

  /**
   * List of targets that traffic is routed to when a request matches the route
   */
  readonly weightedTargets: WeightedTarget[];

  /**
   * Idle duration for the tcp route
   *
   * @default - none
   */
  readonly idle?: cdk.Duration;

  /**
   * PerRequest duration for the tcp route
   *
   * @default - none
   */
  readonly perRequest?: cdk.Duration;
}

/**
 * Properties specific for a TCP Based Routes
 */
export interface TcpRouteSpecOptions {
  /**
   * List of targets that traffic is routed to when a request matches the route
   */
  readonly weightedTargets: WeightedTarget[];

  /**
   * Idle duration for the tcp route
   *
   * @default - none
   */
  readonly idle?: cdk.Duration;
}

/**
 * Properties specific for a GRPC Based Routes
 */
export interface GrpcRouteSpecOptions {
  /**
   * The criterion for determining a request match for this Route
   */
  readonly match: GrpcRouteMatch;

  /**
   * List of targets that traffic is routed to when a request matches the route
   */
  readonly weightedTargets: WeightedTarget[];

  /**
   * Idle duration for the tcp route
   *
   * @default - none
   */
  readonly idle?: cdk.Duration;

  /**
   * PerRequest duration for the tcp route
   *
   * @default - none
   */
  readonly perRequest?: cdk.Duration;
}

/**
 * All Properties for GatewayRoute Specs
 */
export interface RouteSpecConfig {
  /**
   * The spec for an http route
   *
   * @default - no http spec
   */
  readonly httpRouteSpec?: CfnRoute.HttpRouteProperty;

  /**
   * The spec for an http2 route
   *
   * @default - no http2 spec
   */
  readonly http2RouteSpec?: CfnRoute.HttpRouteProperty;

  /**
   * The spec for a grpc route
   *
   * @default - no grpc spec
   */
  readonly grpcRouteSpec?: CfnRoute.GrpcRouteProperty;

  /**
   * The spec for a tcp route
   *
   * @default - no tcp spec
   */
  readonly tcpRouteSpec?: CfnRoute.TcpRouteProperty;
}

/**
 * Used to generate specs with different protocols for a RouteSpec
 */
export abstract class RouteSpec {
  /**
   * Creates an HTTP Based RouteSpec
   */
  public static http(options: HttpRouteSpecOptions): RouteSpec {
    return new HttpRouteSpec(options, Protocol.HTTP);
  }

  /**
   * Creates an HTTP2 Based RouteSpec
   *
   */
  public static http2(options: HttpRouteSpecOptions): RouteSpec {
    return new HttpRouteSpec(options, Protocol.HTTP2);
  }

  /**
   * Creates a TCP Based RouteSpec
   */
  public static tcp(options: TcpRouteSpecOptions): RouteSpec {
    return new TcpRouteSpec(options);
  }

  /**
   * Creates a GRPC Based RouteSpec
   */
  public static grpc(options: GrpcRouteSpecOptions): RouteSpec {
    return new GrpcRouteSpec(options);
  }

  /**
   * Called when the GatewayRouteSpec type is initialized. Can be used to enforce
   * mutual exclusivity with future properties
   */
  public abstract bind(scope: cdk.Construct): RouteSpecConfig;
}

class HttpRouteSpec extends RouteSpec {
  /**
   * Type of route you are creating
   */
  public readonly protocol: Protocol;

  /**
   * The criteria for determining a request match
   */
  public readonly match?: HttpRouteMatch;

  /**
   * List of targets that traffic is routed to when a request matches the route
   */
  public readonly weightedTargets: WeightedTarget[];

  /**
   * Idle duration for the tcp route
   *
   * @default - none
   */
  public readonly idle?: cdk.Duration;

  /**
   * PerRequest duration for the tcp route
   *
   * @default - none
   */
  public readonly perRequest?: cdk.Duration;

  constructor(props: HttpRouteSpecOptions, protocol: Protocol) {
    super();
    this.protocol = protocol;
    this.match = props.match;
    this.weightedTargets = props.weightedTargets;
    this.idle = props.idle;
    this.perRequest = props.perRequest;
  }

  public bind(_scope: cdk.Construct): RouteSpecConfig {
    const prefixPath = this.match ? this.match.prefixPath : '/';
    if (prefixPath[0] != '/') {
      throw new Error(`Prefix Path must start with \'/\', got: ${prefixPath}`);
    }
    const httpConfig: CfnRoute.HttpRouteProperty = {
      action: {
        weightedTargets: renderWeightedTargets(this.weightedTargets),
      },
      match: {
        prefix: prefixPath,
      },
      timeout: {
        idle: this.idle ? this.renderIdleTimeout(this.idle): undefined,
        perRequest: this.perRequest ? this.renderPerRequestTimeout(this.perRequest): undefined,
      },
    };
    return {
      httpRouteSpec: this.protocol === Protocol.HTTP ? httpConfig : undefined,
      http2RouteSpec: this.protocol === Protocol.HTTP2 ? httpConfig : undefined,
    };
  }

  private renderIdleTimeout(idle: cdk.Duration): CfnRoute.DurationProperty {
    return {
      unit: 'ms',
      value: idle?.toMilliseconds(),
    };
  }

  private renderPerRequestTimeout(perRequest: cdk.Duration): CfnRoute.DurationProperty {
    return {
      unit: 'ms',
      value: perRequest?.toMilliseconds(),
    };
  }
}

class TcpRouteSpec extends RouteSpec {
  /*
   * List of targets that traffic is routed to when a request matches the route
   */
  public readonly weightedTargets: WeightedTarget[];

  /**
   * Idle duration for the tcp route
   *
   * @default - none
   */
  public readonly idle?: cdk.Duration;

  constructor(props: TcpRouteSpecOptions) {
    super();
    this.weightedTargets = props.weightedTargets;
    this.idle = props.idle;
  }

  public bind(_scope: cdk.Construct): RouteSpecConfig {
    return {
      tcpRouteSpec: {
        action: {
          weightedTargets: renderWeightedTargets(this.weightedTargets),
        },
        timeout: {
          idle: this.idle ? this.renderIdleTimeout(this.idle): undefined,
        },
      },
    };
  }

  private renderIdleTimeout(idle: cdk.Duration): CfnRoute.DurationProperty {
    return {
      unit: 'ms',
      value: idle?.toMilliseconds(),
    };
  }
}

class GrpcRouteSpec extends RouteSpec {
  public readonly weightedTargets: WeightedTarget[];
  public readonly match: GrpcRouteMatch;

  /**
   * Idle duration for the tcp route
   *
   * @default - none
   */
  public readonly idle?: cdk.Duration;

  /**
   * PerRequest duration for the tcp route
   *
   * @default - none
   */
  public readonly perRequest?: cdk.Duration;

  constructor(props: GrpcRouteSpecOptions) {
    super();
    this.weightedTargets = props.weightedTargets;
    this.match = props.match;
    this.idle = props.idle;
    this.perRequest = props.perRequest;
  }

  public bind(_scope: cdk.Construct): RouteSpecConfig {
    return {
      grpcRouteSpec: {
        action: {
          weightedTargets: renderWeightedTargets(this.weightedTargets),
        },
        match: {
          serviceName: this.match.serviceName,
        },
        timeout: {
          idle: this.idle ? this.renderIdleTimeout(this.idle): undefined,
          perRequest: this.perRequest ? this.renderPerRequestTimeout(this.perRequest): undefined,
        },
      },
    };
  }

  private renderIdleTimeout(idle: cdk.Duration): CfnRoute.DurationProperty {
    return {
      unit: 'ms',
      value: idle?.toMilliseconds(),
    };
  }

  private renderPerRequestTimeout(perRequest: cdk.Duration): CfnRoute.DurationProperty {
    return {
      unit: 'ms',
      value: perRequest?.toMilliseconds(),
    };
  }
}

/**
* Utility method to add weighted route targets to an existing route
*/
function renderWeightedTargets(weightedTargets: WeightedTarget[]): CfnRoute.WeightedTargetProperty[] {
  const renderedTargets: CfnRoute.WeightedTargetProperty[] = [];
  for (const t of weightedTargets) {
    renderedTargets.push({
      virtualNode: t.virtualNode.virtualNodeName,
      weight: t.weight || 1,
    });
  }
  return renderedTargets;
}
