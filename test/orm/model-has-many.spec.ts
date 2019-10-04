/*
* @adonisjs/lucid
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

/// <reference path="../../adonis-typings/index.ts" />

import test from 'japa'
import { column, hasMany } from '../../src/Orm/Decorators'
import { HasManyQueryBuilder } from '../../src/Orm/Relations/HasMany/QueryBuilder'
import { ormAdapter, getBaseModel, setup, cleanup, resetTables, getDb } from '../../test-helpers'

let db: ReturnType<typeof getDb>
let BaseModel: ReturnType<typeof getBaseModel>

test.group('Model | HasMany', (group) => {
  group.before(async () => {
    db = getDb()
    BaseModel = getBaseModel(ormAdapter(db))
    await setup()
  })

  group.after(async () => {
    await cleanup()
    await db.manager.closeAll()
  })

  group.afterEach(async () => {
    await resetTables()
  })

  test('raise error when localKey is missing', (assert) => {
    assert.plan(1)

    try {
      class Post extends BaseModel {
      }

      class User extends BaseModel {
        @hasMany(() => Post)
        public posts: Post[]
      }

      User.$boot()
      User.$getRelation('posts')!.boot()
    } catch ({ message }) {
      assert.equal(
        message,
        'E_MISSING_RELATED_LOCAL_KEY: User.id required by User.posts relation is missing',
      )
    }
  })

  test('raise error when foreignKey is missing', (assert) => {
    assert.plan(1)

    try {
      class Post extends BaseModel {
      }
      Post.$boot()

      class User extends BaseModel {
        @column({ primary: true })
        public id: number

        @hasMany(() => Post)
        public posts: Post[]
      }

      User.$boot()
      User.$getRelation('posts')!.boot()
    } catch ({ message }) {
      assert.equal(
        message,
        'E_MISSING_RELATED_FOREIGN_KEY: Post.userId required by User.posts relation is missing',
      )
    }
  })

  test('use primary key is as the local key', (assert) => {
    class Post extends BaseModel {
      @column()
      public userId: number
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    User.$boot()
    User.$getRelation('posts')!.boot()

    assert.equal(User.$getRelation('posts')!['localKey'], 'id')
    assert.equal(User.$getRelation('posts')!['localAdapterKey'], 'id')
  })

  test('use custom defined primary key', (assert) => {
    class Post extends BaseModel {
      @column()
      public userId: number
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @column({ castAs: 'user_uid' })
      public uid: number

      @hasMany(() => Post, { localKey: 'uid' })
      public posts: Post[]
    }

    User.$boot()
    User.$getRelation('posts')!.boot()

    assert.equal(User.$getRelation('posts')!['localKey'], 'uid')
    assert.equal(User.$getRelation('posts')!['localAdapterKey'], 'user_uid')
  })

  test('compute foreign key from model name and primary key', (assert) => {
    class Post extends BaseModel {
      @column()
      public userId: number
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    User.$boot()
    User.$getRelation('posts')!.boot()

    assert.equal(User.$getRelation('posts')!['foreignKey'], 'userId')
    assert.equal(User.$getRelation('posts')!['foreignAdapterKey'], 'user_id')
  })

  test('use pre defined foreign key', (assert) => {
    class Post extends BaseModel {
      @column({ castAs: 'user_id' })
      public userUid: number
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post, { foreignKey: 'userUid' })
      public posts: Post[]
    }

    User.$boot()
    User.$getRelation('posts')!.boot()

    assert.equal(User.$getRelation('posts')!['foreignKey'], 'userUid')
    assert.equal(User.$getRelation('posts')!['foreignAdapterKey'], 'user_id')
  })

  test('get eager query', (assert) => {
    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    User.$getRelation('posts')!.boot()
    const user = new User()
    user.id = 1

    const { sql, bindings } = User.$getRelation('posts')!
      .getEagerQuery([user], User.query().client)
      .toSQL()

    const { sql: knexSql, bindings: knexBindings } = db.query()
      .from('posts')
      .whereIn('user_id', [1])
      .toSQL()

    assert.equal(sql, knexSql)
    assert.deepEqual(bindings, knexBindings)
  })

  test('get query', (assert) => {
    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    User.$getRelation('posts')!.boot()
    const user = new User()
    user.id = 1

    const { sql, bindings } = User.$getRelation('posts')!
      .getQuery(user, User.query().client)
      .toSQL()

    const { sql: knexSql, bindings: knexBindings } = db.query()
      .from('posts')
      .where('user_id', 1)
      .toSQL()

    assert.equal(sql, knexSql)
    assert.deepEqual(bindings, knexBindings)
  })

  test('queries must be instance of has many query builder', (assert) => {
    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    User.$getRelation('posts')!.boot()
    const user = new User()
    user.id = 1

    const query = User.$getRelation('posts')!.getQuery(user, User.query().client)
    const eagerQuery = User.$getRelation('posts')!.getEagerQuery([user], User.query().client)

    assert.instanceOf(query, HasManyQueryBuilder)
    assert.instanceOf(eagerQuery, HasManyQueryBuilder)
  })

  test('preload has many relationship', async (assert) => {
    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }])

    const users = await db.query().from('users')
    await db.insertQuery().table('posts').insert([
      {
        user_id: users[0].id,
        title: 'Adonis 101',
      },
      {
        user_id: users[0].id,
        title: 'Lucid 101',
      },
    ])

    User.$boot()
    const user = await User.query().preload('posts').where('username', 'virk').first()
    assert.lengthOf(user!.posts, 2)
    assert.instanceOf(user!.posts[0], Post)
    assert.equal(user!.posts[0].userId, user!.id)

    assert.instanceOf(user!.posts[1], Post)
    assert.equal(user!.posts[1].userId, user!.id)
  })

  test('preload has many relationship for many rows', async (assert) => {
    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await db.insertQuery().table('posts').insert([
      {
        user_id: 1,
        title: 'Adonis 101',
      },
      {
        user_id: 1,
        title: 'Lucid 101',
      },
      {
        user_id: 2,
        title: 'Lucid 102',
      },
    ])

    User.$boot()
    const users = await User.query().preload('posts')

    assert.lengthOf(users[0]!.posts, 2)
    assert.instanceOf(users[0].posts[0], Post)
    assert.equal(users[0].posts[0].userId, users[0].id)
    assert.instanceOf(users[0].posts[1], Post)
    assert.equal(users[0].posts[1].userId, users[0].id)

    assert.lengthOf(users[1]!.posts, 1)
    assert.instanceOf(users[1].posts[0], Post)
    assert.equal(users[1].posts[0].userId, users[1].id)
  })

  test('preload has many relationship using model instance', async (assert) => {
    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await db.insertQuery().table('posts').insert([
      {
        user_id: 1,
        title: 'Adonis 101',
      },
      {
        user_id: 1,
        title: 'Lucid 101',
      },
      {
        user_id: 2,
        title: 'Lucid 102',
      },
    ])

    User.$boot()
    const users = await User.query().orderBy('id', 'asc')

    await users[0].preload('posts')
    await users[1].preload('posts')

    assert.lengthOf(users[0]!.posts, 2)
    assert.instanceOf(users[0].posts[0], Post)
    assert.equal(users[0].posts[0].userId, users[0].id)
    assert.instanceOf(users[0].posts[1], Post)
    assert.equal(users[0].posts[1].userId, users[0].id)

    assert.lengthOf(users[1]!.posts, 1)
    assert.instanceOf(users[1].posts[0], Post)
    assert.equal(users[1].posts[0].userId, users[1].id)
  })

  test('raise exception when local key is not selected', async (assert) => {
    assert.plan(1)

    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])

    const users = await db.query().from('users')
    await db.insertQuery().table('posts').insert([
      {
        user_id: users[0].id,
        title: 'Adonis 101',
      },
      {
        user_id: users[1].id,
        title: 'Lucid 101',
      },
    ])

    try {
      await User.query().select('username').preload('posts').where('username', 'virk').first()
    } catch ({ message }) {
      assert.equal(message, 'Cannot preload posts, value of User.id is undefined')
    }
  })

  test('pass callback to preload', async (assert) => {
    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public displayName: string
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await db.insertQuery().table('posts').insert([
      {
        user_id: 1,
        title: 'Adonis 101',
      },
      {
        user_id: 2,
        title: 'Lucid 101',
      },
    ])

    User.$boot()

    const user = await User.query().preload('posts', (builder) => {
      builder.whereNull('title')
    }).where('username', 'virk').first()

    assert.lengthOf(user!.posts, 0)
  })

  test('preload nested relations', async (assert) => {
    class Comment extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public postId: number

      @column()
      public body: string
    }

    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string

      @hasMany(() => Comment)
      public comments: Comment[]
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await db.insertQuery().table('posts').insert([
      {
        user_id: 1,
        title: 'Adonis 101',
      },
      {
        user_id: 2,
        title: 'Lucid 101',
      },
    ])

     await db.insertQuery().table('comments').insert([
      {
        post_id: 1,
        body: 'Looks nice',
      },
      {
        post_id: 2,
        body: 'Wow! Never knew that',
      },
    ])

    const user = await User.query()
      .preload('posts.comments')
      .where('username', 'virk')
      .first()

    assert.lengthOf(user!.posts, 1)
    assert.lengthOf(user!.posts[0].comments, 1)
    assert.equal(user!.posts[0].comments[0].postId, user!.posts[0].id)
  })

  test('preload nested relations with primary relation repeating twice', async (assert) => {
    class Comment extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public postId: number

      @column()
      public body: string
    }

    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string

      @hasMany(() => Comment)
      public comments: Comment[]
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await db.insertQuery().table('posts').insert([
      {
        user_id: 1,
        title: 'Adonis 101',
      },
      {
        user_id: 2,
        title: 'Lucid 101',
      },
    ])

     await db.insertQuery().table('comments').insert([
      {
        post_id: 1,
        body: 'Looks nice',
      },
      {
        post_id: 2,
        body: 'Wow! Never knew that',
      },
    ])

    const query = User.query()
      .preload('posts')
      .preload('posts.comments')
      .where('username', 'virk')

    const user = await query.first()
    assert.lengthOf(user!.posts, 1)
    assert.lengthOf(user!.posts[0].comments, 1)
    assert.equal(user!.posts[0].comments[0].postId, user!.posts[0].id)

    assert.lengthOf(Object.keys(query['_preloader']['_preloads']), 1)
    assert.property(query['_preloader']['_preloads'], 'posts')
    assert.lengthOf(query['_preloader']['_preloads'].posts.children, 1)
    assert.equal(query['_preloader']['_preloads'].posts.children[0].relationName, 'comments')
  })

  test('preload nested relations using model instance', async (assert) => {
    class Comment extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public postId: number

      @column()
      public body: string
    }

    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string

      @hasMany(() => Comment)
      public comments: Comment[]
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await db.insertQuery().table('posts').insert([
      {
        user_id: 1,
        title: 'Adonis 101',
      },
      {
        user_id: 2,
        title: 'Lucid 101',
      },
    ])

     await db.insertQuery().table('comments').insert([
      {
        post_id: 1,
        body: 'Looks nice',
      },
      {
        post_id: 2,
        body: 'Wow! Never knew that',
      },
    ])

    const users = await User.all()

    await users[0].preload((preloader) => {
      preloader.preload('posts').preload('posts.comments')
    })

    await users[1].preload((preloader) => {
      preloader.preload('posts').preload('posts.comments')
    })

    assert.lengthOf(users[0].posts, 1)
    assert.lengthOf(users[0].posts[0].comments, 1)
    assert.equal(users[0].posts[0].comments[0].postId, users[0].posts[0].id)

    assert.lengthOf(users[1].posts, 1)
    assert.lengthOf(users[1].posts[0].comments, 1)
    assert.equal(users[1].posts[0].comments[0].postId, users[1].posts[0].id)
  })

  test('pass main query options down the chain', async (assert) => {
    class Comment extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public postId: number

      @column()
      public body: string
    }

    class Post extends BaseModel {
      @column({ primary: true })
      public id: number

      @column()
      public userId: number

      @column()
      public title: string

      @hasMany(() => Comment)
      public comments: Comment[]
    }

    class User extends BaseModel {
      @column({ primary: true })
      public id: number

      @hasMany(() => Post)
      public posts: Post[]
    }

    await db.insertQuery().table('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await db.insertQuery().table('posts').insert([
      {
        user_id: 1,
        title: 'Adonis 101',
      },
      {
        user_id: 2,
        title: 'Lucid 101',
      },
    ])

     await db.insertQuery().table('comments').insert([
      {
        post_id: 1,
        body: 'Looks nice',
      },
      {
        post_id: 2,
        body: 'Wow! Never knew that',
      },
    ])

    const query = User.query({ connection: 'secondary' })
      .preload('posts')
      .preload('posts.comments')
      .where('username', 'virk')

    const user = await query.first()
    assert.lengthOf(user!.posts, 1)
    assert.lengthOf(user!.posts[0].comments, 1)
    assert.equal(user!.posts[0].comments[0].postId, user!.posts[0].id)

    assert.equal(user!.$options!.connection, 'secondary')
    assert.equal(user!.posts[0].$options!.connection, 'secondary')
    assert.equal(user!.posts[0].comments[0].$options!.connection, 'secondary')
  })
})

// test.group('Model | HasMany | persist', (group) => {
//   group.before(async () => {
//     db = getDb()
//     BaseModel = getBaseModel(ormAdapter(db))
//     await setup()
//   })

//   group.after(async () => {
//     await cleanup()
//     await db.manager.closeAll()
//   })

//   group.afterEach(async () => {
//     await resetTables()
//   })

//   test('save related instance', async (assert) => {
//     class Post extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public userId: number

//       @column()
//       public title: string
//     }

//     class User extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public username: string

//       @hasMany(() => Post)
//       public posts: Post[]
//     }

//     const user = new User()
//     user.username = 'virk'
//     await user.save()

//     const post = new Post()
//     post.title = 'Hvirk'

//     await user.saveRelated('posts', post)

//     assert.isTrue(post.$persisted)
//     assert.equal(user.id, post.userId)
//   })

//   test('use parent model transaction when defined', async (assert) => {
//     class Post extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public userId: number

//       @column()
//       public title: string
//     }

//     class User extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public username: string

//       @hasMany(() => Post)
//       public posts: Post[]
//     }

//     const trx = await db.transaction()

//     const user = new User()
//     user.username = 'virk'
//     user.$trx = trx

//     await user.save()

//     const post = new Post()
//     post.title = 'Hvirk'

//     await user.saveRelated('posts', post)
//     assert.isTrue(post.$persisted)
//     assert.equal(user.id, post.userId)

//     await trx.rollback()
//     const totalUsers = await db.from('users').count('*', 'total')
//     const totalPosts = await db.from('posts').count('*', 'total')

//     assert.equal(totalPosts[0].total, 0)
//     assert.equal(totalUsers[0].total, 0)
//     assert.isUndefined(user.$trx)
//     assert.isUndefined(post.$trx)
//   })

//   test('use parent model options when defined', async (assert) => {
//     class Post extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public userId: number

//       @column()
//       public title: string
//     }

//     class User extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public username: string

//       @hasMany(() => Post)
//       public posts: Post[]
//     }

//     const user = new User()
//     user.username = 'virk'
//     user.$options = { connection: 'secondary' }
//     await user.save()

//     const post = new Post()
//     post.title = 'Hvirk'

//     await user.saveRelated('posts', post)

//     assert.isTrue(post.$persisted)
//     assert.equal(user.id, post.userId)

//     assert.deepEqual(user.$options, { connection: 'secondary' })
//     assert.deepEqual(post.$options, { connection: 'secondary' })
//   })

//   test('persist parent model when not already persisted', async (assert) => {
//     class Post extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public userId: number

//       @column()
//       public title: string
//     }

//     class User extends BaseModel {
//       @column({ primary: true })
//       public id: number

//       @column()
//       public username: string

//       @hasMany(() => Post)
//       public posts: Post[]
//     }

//     const user = new User()
//     user.username = 'virk'

//     const post = new Post()
//     post.title = 'Hvirk'

//     await user.saveRelated('posts', post)

//     assert.isTrue(post.$persisted)
//     assert.equal(user.id, post.userId)
//   })
// })
