import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
const timestamp=name=>integer(name,{mode:'timestamp_ms'});
export const user=sqliteTable('auth_user',{
 id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull().unique(),emailVerified:integer('email_verified',{mode:'boolean'}).notNull().default(false),image:text('image'),createdAt:timestamp('created_at').notNull(),updatedAt:timestamp('updated_at').notNull()
});
export const session=sqliteTable('auth_session',{
 id:text('id').primaryKey(),expiresAt:timestamp('expires_at').notNull(),token:text('token').notNull().unique(),createdAt:timestamp('created_at').notNull(),updatedAt:timestamp('updated_at').notNull(),ipAddress:text('ip_address'),userAgent:text('user_agent'),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'})
});
export const account=sqliteTable('auth_account',{
 id:text('id').primaryKey(),issuer:text('issuer').notNull(),accountId:text('account_id').notNull(),providerId:text('provider_id').notNull(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),accessToken:text('access_token'),refreshToken:text('refresh_token'),idToken:text('id_token'),accessTokenExpiresAt:timestamp('access_token_expires_at'),refreshTokenExpiresAt:timestamp('refresh_token_expires_at'),scope:text('scope'),password:text('password'),createdAt:timestamp('created_at').notNull(),updatedAt:timestamp('updated_at').notNull()
});
export const verification=sqliteTable('auth_verification',{id:text('id').primaryKey(),identifier:text('identifier').notNull(),value:text('value').notNull(),expiresAt:timestamp('expires_at').notNull(),createdAt:timestamp('created_at').notNull(),updatedAt:timestamp('updated_at').notNull()});
export const rateLimit=sqliteTable('auth_rate_limit',{id:text('id').primaryKey(),key:text('key').notNull().unique(),count:integer('count').notNull(),lastRequest:integer('last_request').notNull()});
