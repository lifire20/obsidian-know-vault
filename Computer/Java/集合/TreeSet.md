---
tags:
  - TreeSet
---
可排序，不重复，无索引
默认从小到大排序
底层是基于红黑树的数据结构实现排序
```java
TreeSet<Integer> ts=new TreeSet<>();  
ts.add(4);  
ts.add(5);  
ts.add(1);  
ts.add(3);  
ts.add(2);  
System.out.println(ts);//[1, 2, 3, 4, 5]
```
### 遍历
```java
//迭代器遍历  
Iterator<Integer> it = ts.iterator();  
while(it.hasNext()){  
    int i=it.next();  
        System.out.println(i);  
  
}  
  
//增强for  
for(int i:ts){  
    System.out.println(i);  
}  
  
//Lambda  
ts.forEach( integer ->System.out.println(integer));
```

### 排序规则
**对于数值类型**：Integer,Double,默认按照从小到大的顺序进行排序。
**对于字符、字符串类型**：按照字符在 ASC 川码表中的数字*升序*进行排序。
> [! tips] TreeSet的两种比较方式
> **方式一（默认使用）**
> 默认/自然排序：Javabean 类实现 comparable 接口指定比较规则
> **方式二**
> 比较器排序：创建 TreeSet 对象的时候传递比较器 comparator 指定规则