---
tags:
  - 字符串
  - 字符串比较
  - String
---

### 创建 String 对象的方式
1.直接赋值
2.new 构造
字符串的内容是不会改变的，它的对象在创建之后不能被更改
![[Pasted image 20260923135500.png]]
String Table（串池） 
也叫字符串常量池（方法区→堆内存）

当使用双引号直接赋值时，系统会检查只该字符串在串池中是否存在，不存在：创建新的.存在：复用
### 字符串比较
1.  boolean equals 方法(要比较的字符串）
	1. 必须完全一样
2. boolean equalslgnoreCase（要比较的字符串）
	1. 可以忽略大小写
`boolean result= s1.equal(s2);`
