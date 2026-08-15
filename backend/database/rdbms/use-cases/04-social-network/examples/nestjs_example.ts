// npm install @nestjs/typeorm typeorm pg
// TypeORM hỗ trợ sẵn dữ liệu phân cấp qua @Tree() — dùng chiến lược 'closure-table':
// TypeORM tự tạo thêm 1 bảng phụ (comments_closure) để tra cứu ancestor/descendant
// nhanh, KHÔNG đổi schema bảng comments (parent_comment_id vẫn giữ nguyên).

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, PrimaryColumn,
  Tree, TreeChildren, TreeParent, JoinColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column('text')
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('likes')
export class Like {
  @PrimaryColumn({ name: 'user_id', type: 'bigint' })
  userId: number;

  @PrimaryColumn({ name: 'post_id', type: 'bigint' })
  postId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('follows')
export class Follow {
  @PrimaryColumn({ name: 'follower_id', type: 'bigint' })
  followerId: number;

  @PrimaryColumn({ name: 'followee_id', type: 'bigint' })
  followeeId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('comments')
@Tree('closure-table')
export class Comment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'post_id', type: 'bigint' })
  postId: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column('text')
  content: string;

  @TreeChildren()
  children: Comment[];

  @TreeParent()
  @JoinColumn({ name: 'parent_comment_id' })
  parent: Comment | null;
}

import { Injectable, Controller, Get, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment) private readonly commentRepo: TreeRepository<Comment>,
  ) {}

  async getThread(postId: number) {
    const roots = await this.commentRepo.find({ where: { postId, parent: null } });
    // findDescendantsTree(): TypeORM tự truy vấn dựa trên closure table, không viết SQL tay
    return Promise.all(roots.map((root) => this.commentRepo.findDescendantsTree(root)));
  }
}

@Controller('posts')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get(':postId/comments/thread')
  getThread(@Param('postId') postId: number) {
    return this.commentService.getThread(postId);
  }
}
