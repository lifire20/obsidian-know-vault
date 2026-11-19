---
tags:
  - TreeMap
  - 双列集合
  - 错误排查
---
- TreeMap 跟 [[TreeSet]] 底层原理一样，都是红黑树结构的。
- 由键决定特性：不重复、无索引、可排序
- 可排序：对键进行排序。
- 注意：默认按照键的从小到大进行排序，也可以自己规定键的排序规则

TreeMap 的两种比较方式（两个都有的时候按照第二个来）
**方式一（默认使用）**  
默认/自然排序：Javabean 类实现 comparable 接口指定比较规则  
```
public class Student implements Comparable<Student>{

//重写方法
@Override  
public int compareTo(Student o) {  
    int i=this.getAge()-o.getAge();  //先按照年龄
    i=i==0 ? this.getName().compareTo(o.getName()): i;  
    return i;  
}

}
```
**方式二**  
比较器排序：创建集合的时候传递比较器 comparator 对象，指定规则
```
TreeMap<Integer,String> tm=new TreeMap<>(new Comparator<Integer>() {  
    @Override  
    public int compare(Integer o1, Integer o2) {  
        //o1:当前要添加的元素  
        //o2:已经在红黑树中存在的元素  
        return o2-o1;  //降序排序
    }});  
tm.put(1,"可乐");  
tm.put(3,"牛奶");  
tm.put(2,"面包");  
System.out.println(tm);
```