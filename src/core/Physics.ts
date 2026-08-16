export interface AABB {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface PhysicsBody {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
  isGrounded: boolean;
}

export type BoundedBody = PhysicsBody & { getBounds?: () => AABB };

export interface PhysicsOptions {
  gravity?: number;
  maxVelocityX?: number;
  maxVelocityY?: number;
}

export class Physics {
  public gravity: number = 0.2;
  public maxVelocityX: number = 10;
  public maxVelocityY: number = 20;

  constructor(options: PhysicsOptions = {}) {
    if (options.gravity !== undefined) this.gravity = options.gravity;
    if (options.maxVelocityX !== undefined) this.maxVelocityX = options.maxVelocityX;
    if (options.maxVelocityY !== undefined) this.maxVelocityY = options.maxVelocityY;
  }

  public applyGravity(body: PhysicsBody, deltaTime: number = 1): void {
    if (!body.isGrounded) {
      body.velocityY -= this.gravity * deltaTime;
    }
  }

  public applyVelocity(body: PhysicsBody, deltaTime: number = 1): void {
    body.velocityX = Math.max(-this.maxVelocityX, Math.min(this.maxVelocityX, body.velocityX));
    body.velocityY = Math.max(-this.maxVelocityY, Math.min(this.maxVelocityY, body.velocityY));

    body.x += body.velocityX * deltaTime;
    body.y += body.velocityY * deltaTime;
  }

  public getBounds(body: BoundedBody): AABB {
    if (typeof body.getBounds === 'function') {
      return body.getBounds();
    }
    return {
      left: body.x - body.width / 2,
      right: body.x + body.width / 2,
      bottom: body.y - body.height / 2,
      top: body.y + body.height / 2,
    };
  }

  public checkAABBCollision(a: BoundedBody, b: BoundedBody): boolean {
    const boundsA = this.getBounds(a);
    const boundsB = this.getBounds(b);

    return (
      boundsA.left < boundsB.right &&
      boundsA.right > boundsB.left &&
      boundsA.bottom < boundsB.top &&
      boundsA.top > boundsB.bottom
    );
  }
}
