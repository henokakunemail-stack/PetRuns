export interface RedisGeoMember {
  member: string;
  latitude: number;
  longitude: number;
  distMeters?: number;
}

export interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  geoadd(key: string, longitude: number, latitude: number, member: string): Promise<number>;
  geosearch(
    key: string,
    longitude: number,
    latitude: number,
    radiusMeters: number
  ): Promise<Array<{ member: string; distance: number }>>;
  zrem(key: string, ...members: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  rpush(key: string, ...elements: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

export class InMemoryRedisClient implements IRedisClient {
  private kv = new Map<string, { value: string; expiresAt?: number }>();
  private geoSets = new Map<string, Map<string, { lon: number; lat: number }>>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();

  private isExpired(key: string): boolean {
    const item = this.kv.get(key);
    if (!item) return true;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.kv.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null;
    return this.kv.get(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null> {
    let expiresAt: number | undefined;
    if (mode === 'EX' && duration) {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === 'PX' && duration) {
      expiresAt = Date.now() + duration;
    }
    this.kv.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.kv.delete(key)) count++;
      if (this.geoSets.delete(key)) count++;
      if (this.hashes.delete(key)) count++;
      if (this.lists.delete(key)) count++;
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = current ? parseInt(current, 10) + 1 : 1;
    const item = this.kv.get(key);
    this.kv.set(key, { value: String(num), expiresAt: item?.expiresAt });
    return num;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.kv.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.kv.get(key);
    if (!item || !item.expiresAt) return -1;
    const remaining = Math.ceil((item.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async geoadd(key: string, longitude: number, latitude: number, member: string): Promise<number> {
    if (!this.geoSets.has(key)) {
      this.geoSets.set(key, new Map());
    }
    const set = this.geoSets.get(key)!;
    const isNew = !set.has(member);
    set.set(member, { lon: longitude, lat: latitude });
    return isNew ? 1 : 0;
  }

  async geosearch(
    key: string,
    longitude: number,
    latitude: number,
    radiusMeters: number
  ): Promise<Array<{ member: string; distance: number }>> {
    const set = this.geoSets.get(key);
    if (!set) return [];

    const results: Array<{ member: string; distance: number }> = [];

    // Haversine formula
    for (const [member, coord] of set.entries()) {
      const dist = haversineDistanceMeters(latitude, longitude, coord.lat, coord.lon);
      if (dist <= radiusMeters) {
        results.push({ member, distance: Math.round(dist) });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const set = this.geoSets.get(key);
    if (!set) return 0;
    let count = 0;
    for (const m of members) {
      if (set.delete(m)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matched: string[] = [];
    for (const key of this.kv.keys()) {
      if (!this.isExpired(key) && regex.test(key)) {
        matched.push(key);
      }
    }
    for (const key of this.hashes.keys()) {
      if (regex.test(key) && !matched.includes(key)) {
        matched.push(key);
      }
    }
    return matched;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    const isNew = !hash.has(field);
    hash.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashes.get(key);
    return hash?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    const res: Record<string, string> = {};
    for (const [k, v] of hash.entries()) {
      res[k] = v;
    }
    return res;
  }

  async rpush(key: string, ...elements: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.push(...elements);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const redisClient: IRedisClient = new InMemoryRedisClient();
