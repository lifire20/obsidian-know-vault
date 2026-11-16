---
tags:
  - 集合
  - ArrayList
---
## 集合的特点
集合长度可变，可以实现自动扩容，但是不能直接存基本数据类型，要想存的话，需要[[Computer/Java/集合/包装类]]。
## 泛型
限定集合中存储数据的类型
## 创建集合的对象
```
ArrayList<String> list=new ArrayList<>();
```

## ArrayList 的成员方法
![[Pasted image 20260923155538.png]]

遍历
```
for (int i=0;i<list.size();i++){
	//i为索引
	//list.get(i)为元素
	String str=list>get(i);
	System.out.println(str);
```

## 底层原理
- 利用空参创建的集合，在底层会创建一个默认长度为零的数组。
- 添加第 1 个元素时，底层会创建一个新的长度为 10 的数组。、
- 存满时，自动扩容 1.5 倍
- 如果一次添加多个元素，1.5 倍还放不下，则新创建的数组的长度以实际为准。