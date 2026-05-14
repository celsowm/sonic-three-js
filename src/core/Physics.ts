export class Physics {
  public gravity: number = 0.2;
  public friction: number = 0.05;
  public maxVelocityX: number = 10;
  public maxVelocityY: number = 20;

  constructor(options?: { gravity?: number; friction?: number; maxVelocityX?: number; maxVelocityY?: number }) {
    if (options?.gravity !== undefined) this.gravity = options.gravity;
    if (options?.friction !== undefined) this.friction = options.friction;
    if (options?.maxVelocityX !== undefined) this.maxVelocityX = options.maxVelocityX;
    if (options?.maxVelocityY !== undefined) this.maxVelocityY = options.maxVelocityY;
  }

  public applyGravity(entity: any, deltaTime: number = 1) {
    if (!entity.isGrounded) {
      entity.velocityY -= this.gravity * deltaTime;
    }
  }

  public applyFriction(entity: any, deltaTime: number = 1) {
    if (entity.isGrounded) {
      if (entity.velocityX > 0) {
        entity.velocityX = Math.max(0, entity.velocityX - this.friction * deltaTime);
      } else if (entity.velocityX < 0) {
        entity.velocityX = Math.min(0, entity.velocityX + this.friction * deltaTime);
      }
    }
  }

  public applyVelocity(entity: any, deltaTime: number = 1) {
    entity.velocityX = Math.max(-this.maxVelocityX, Math.min(this.maxVelocityX, entity.velocityX));
    entity.velocityY = Math.max(-this.maxVelocityY, Math.min(this.maxVelocityY, entity.velocityY));

    entity.x += entity.velocityX * deltaTime;
    entity.y += entity.velocityY * deltaTime;
  }

  public checkAABBCollision(a: any, b: any): boolean {
    const boundsA = typeof a.getBounds === 'function'
      ? a.getBounds()
      : { left: a.x, right: a.x + a.width, bottom: a.y, top: a.y + a.height };
    const boundsB = typeof b.getBounds === 'function'
      ? b.getBounds()
      : { left: b.x, right: b.x + b.width, bottom: b.y, top: b.y + b.height };

    return (
      boundsA.left < boundsB.right &&
      boundsA.right > boundsB.left &&
      boundsA.bottom < boundsB.top &&
      boundsA.top > boundsB.bottom
    );
  }
}
