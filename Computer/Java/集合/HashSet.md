---
tags:
  - HashSet
---
底层使用哈希表存储数据
**组成**
数组+链表+红黑树
> [! 哈希值]
> 1. 是指对象的整数表现形式,根据 Hashcode的方法算出来的 int 类型的整数
> 2. 该方法定义在 object 类中，所有对象都可以调用，默认使用**地址值**进行计算
> 3. 一般情况下会重写Hashcode 方法，利用对象内部的属性值，计算哈希值

**对象的哈希值特点**
- 如果没有重写Hashcode 方法，不同对象计算出的哈希值是不同的
- 如果已经重写哈希 Hashcode 方法，不同对象只要属性值相同，计算出的哈希值就是一样的
- 在极端情况下，不同的属性值或者不同的地址值计算出来的哈希值也有可能一样（哈希碰撞）
```java
//Student类
@Override  
public int hashCode() {  
    return Objects.hash(name, age);  
}

//test类
Student s1=new Student("张三",18);  
Student s2=new Student("张三",18);  
  
System.out.println(s1.hashCode());  //24022538
System.out.println(s2.hashCode());//24022538
```

**底层原理**
![[Pasted image 20261115183156 copy.png]]
当数组里面的元素存了 16×0.75=12 个元素的时候，数组就会扩容为原来的两倍
当链表的长度大于 8，并且数组的长度大于等于 64 的时候，当前的链表就会自动地转成红黑树

