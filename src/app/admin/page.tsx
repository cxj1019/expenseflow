//src\app\admin\page.tsx

'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, FormEvent, ChangeEvent, useCallback } from 'react'
import type { Database, TablesInsert, TablesUpdate } from '@/types/database.types'

// --- 类型定义 ---
type Profile = Database['public']['Tables']['profiles']['Row']
type Customer = Database['public']['Tables']['customers']['Row']

// FIX: 临时的 CostCenter 类型定义
// 这里的定义是为了防止页面报错，等你数据库添加了 cost_centers 表后，
// 请取消注释下方的真实类型引用，并删除这个临时接口。
type CostCenter = { id: number; name: string; created_at: string | null; };
// type CostCenter = Database['public']['Tables']['cost_centers']['Row']

// 管理实体联合类型
type ManageableEntity = Profile | Customer | CostCenter;
type ModalType = 'user' | 'customer' | 'cost_center';

export default function AdminPage() {
  // --- 状态管理 ---
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // --- 模态框状态 ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [editingEntity, setEditingEntity] = useState<ManageableEntity | null>(null);
  
  // 为不同类型的实体创建独立的、类型安全的表单状态
  const [userFormData, setUserFormData] = useState<Partial<Profile>>({});
  const [customerFormData, setCustomerFormData] = useState<Partial<Customer>>({});

  // 通知状态
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  
  // --- 通知处理函数 ---
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
  };

  // --- 数据获取 ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileError || !profileData) {
      router.push('/dashboard');
      return;
    }
    if (profileData.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    setAdminProfile(profileData);

    const [usersRes, customersRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('customers').select('*').order('name'),
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
    
    setLoading(false);
  }, [router, supabase]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 模态框控制 ---
  const openModal = (type: ModalType, entity: ManageableEntity | null = null) => {
    setModalType(type);
    setEditingEntity(entity);
    
    if (type === 'user' && entity && 'role' in entity) {
      setUserFormData(entity);
    } else if (type === 'customer' && entity && 'name' in entity) {
      setCustomerFormData(entity);
    } else if (type === 'customer' && !entity) {
      // 新增客户时清空表单
      setCustomerFormData({});
    }
    
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setEditingEntity(null);
    setUserFormData({});
    setCustomerFormData({});
  };

  // --- 表单处理 ---
  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (modalType === 'user') {
        setUserFormData((prev) => ({ ...prev, [name]: value }));
    } else if (modalType === 'customer') {
        setCustomerFormData((prev) => ({...prev, [name]: value }));
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalType) return;
  
    setIsProcessing(true);
    let error;
  
    try {
      switch (modalType) {
        case 'user':
          // 类型守卫：确保编辑的是 User
          if (editingEntity && 'role' in editingEntity) {
            const updates: TablesUpdate<'profiles'> = {};
            
            // 仅添加变更的字段
            if (userFormData.full_name !== editingEntity.full_name) updates.full_name = userFormData.full_name;
            if (userFormData.department !== editingEntity.department) updates.department = userFormData.department;
            if (userFormData.phone !== editingEntity.phone) updates.phone = userFormData.phone;
            if (userFormData.role !== editingEntity.role) updates.role = userFormData.role;
            
            if (Object.keys(updates).length > 0) {
              const { error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', editingEntity.id);
              error = updateError;
            } else {
              showNotification('未作任何修改。', 'success');
              closeModal();
              setIsProcessing(false);
              return;
            }
          }
          break;
  
        case 'customer':
          if (editingEntity && 'name' in editingEntity) {
            // --- 编辑现有客户 ---
            if (customerFormData.name && customerFormData.name !== editingEntity.name) {
               const updates: TablesUpdate<'customers'> = { name: customerFormData.name };
               const { error: updateError } = await supabase
                .from('customers')
                .update(updates)
                .eq('id', editingEntity.id);
              error = updateError;
            } else {
              showNotification('未作任何修改。', 'success');
              closeModal();
              setIsProcessing(false);
              return;
            }
          } else {
            // --- 新增客户 ---
            const newName = customerFormData.name?.trim();
            if (!newName) {
                showNotification('客户名称不能为空。', 'error');
                setIsProcessing(false);
                return;
            }
            
            // 使用 TablesInsert 确保类型安全，不再需要 as any
            const insertData: TablesInsert<'customers'> = { name: newName };
            const { error: insertError } = await supabase
                .from('customers')
                .insert(insertData);
            error = insertError;
          }
          break;
  
        case 'cost_center':
          console.log('Submitting for cost_center (Feature Pending)');
          showNotification('成本中心功能开发中', 'success');
          setIsProcessing(false);
          closeModal();
          return;
      }
  
      if (error) throw error;
      
      showNotification('保存成功！');
      closeModal();
      await fetchData();

    } catch (err: unknown) {
      console.error('Submit error:', err);
      if (err instanceof Error) {
        showNotification(`操作失败: ${err.message}`, 'error');
      } else {
        showNotification('操作失败: 发生未知错误', 'error');
      }
    } finally {
        setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">正在加载管理后台...</div>;
  }

  if (!adminProfile) {
    return <div className="flex justify-center items-center min-h-screen">您没有权限访问此页面。</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">系统管理</h1>
        
      {notification && (
        <div className="mb-6">
            <div className={`p-4 rounded-md text-sm ${ notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                {notification.message}
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* 用户管理卡片 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">用户列表</h2>
          <div className="max-h-[400px] overflow-y-auto">
            <ul className="space-y-2">
                {users.map(user => (
                <li key={user.id} className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
                    <div>
                        <span className="block font-medium">{user.full_name}</span>
                        <span className="text-xs text-gray-500">{user.role} | {user.department || '无部门'}</span>
                    </div>
                    <button onClick={() => openModal('user', user)} className="text-blue-600 hover:underline text-sm">编辑</button>
                </li>
                ))}
            </ul>
          </div>
        </div>

        {/* 客户管理卡片 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">客户列表</h2>
          <button onClick={() => openModal('customer', null)} className="w-full mb-4 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + 新增客户
          </button>
          <div className="max-h-[400px] overflow-y-auto">
            <ul className="space-y-2">
                {customers.map(customer => (
                <li key={customer.id} className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
                    <span>{customer.name}</span>
                    <button onClick={() => openModal('customer', customer)} className="text-blue-600 hover:underline text-sm">编辑</button>
                </li>
                ))}
            </ul>
          </div>
        </div>

        {/* 成本中心管理卡片 (占位) */}
        <div className="bg-white p-6 rounded-lg shadow opacity-75">
          <h2 className="text-xl font-semibold mb-4">成本中心</h2>
          <div className="flex items-center justify-center h-32 bg-gray-50 rounded border border-dashed border-gray-300">
            <p className="text-gray-500 text-sm">此功能正在开发中...</p>
          </div>
        </div>
      </div>
      
      {/* 模态框 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <form onSubmit={handleFormSubmit}>
              <h2 className="text-2xl font-bold mb-6">
                {editingEntity ? '编辑' : '新增'} {modalType === 'user' ? '用户' : modalType === 'customer' ? '客户' : '成本中心'}
              </h2>
              
              {modalType === 'user' && (
                <>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">姓名</label>
                    <input name="full_name" value={userFormData.full_name || ''} onChange={handleFormChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500" />
                  </div>
                   <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">部门</label>
                    <input name="department" value={userFormData.department || ''} onChange={handleFormChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">电话</label>
                    <input name="phone" value={userFormData.phone || ''} onChange={handleFormChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500" />
                  </div>
                   <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">角色</label>
                    <select name="role" value={userFormData.role || ''} onChange={handleFormChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500 bg-white">
                        <option value="employee">Employee (员工)</option>
                        <option value="manager">Manager (经理)</option>
                        <option value="partner">Partner (合伙人)</option>
                        <option value="admin">Admin (管理员)</option>
                    </select>
                  </div>
                </>
              )}
              
              {modalType === 'customer' && (
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">客户名称</label>
                    <input name="name" value={customerFormData.name || ''} onChange={handleFormChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500" required placeholder="请输入客户公司全称"/>
                </div>
              )}
              
              <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">取消</button>
                <button type="submit" disabled={isProcessing} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
                    {isProcessing ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}