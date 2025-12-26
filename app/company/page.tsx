"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/* ===============================
   타입 정의
   =============================== */
type Product = {
  id: string;
  product_name: string;
  start_date: string;
  end_date: string;
  supply_amount: number;
};

type Order = {
  id: string;
  product_name: string;
  quantity: number;
  order_date: string;
};

type Feedback = {
  sender: string;
  message: string;
};

/* ===============================
   컴포넌트
   =============================== */
export default function CompanyPage() {
  /* ---------- state ---------- */
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [demandAmount, setDemandAmount] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");

  const [canOrder, setCanOrder] = useState(false);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  /* ===============================
     fetch 함수들 (중요)
     =============================== */
  async function fetchProducts() {
    const { data } = await supabase
      .from("products")
      .select("id, product_name, start_date, end_date, supply_amount")
      .order("created_at", { ascending: false });

    setProducts(data ?? []);
  }

  async function fetchOrders() {
    const { data } = await supabase
      .from("orders")
      .select(`
        id,
        order_date,
        quantity,
        products (
          product_name
        )
      `)
      .order("created_at", { ascending: false });

    setOrders(
      (data ?? []).map((o: any) => ({
        id: o.id,
        product_name: o.products.product_name,
        quantity: o.quantity,
        order_date: o.order_date,
      }))
    );
  }

  async function fetchFeedbacks(orderId: string) {
    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setFeedbacks(data ?? []);
  }
  
  /* ===============================
     최초 로딩
     =============================== */
  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, []);

  /* ===============================
     선택 상품 추적
     =============================== */
  useEffect(() => {
    const found = products.find(p => p.id === selectedProductId);
    setSelectedProduct(found ?? null);
  }, [selectedProductId, products]);

  /* ===============================
     발주 가능 여부 판단
     =============================== */
  useEffect(() => {
    if (!selectedProduct || demandAmount <= 0 || !selectedDate) {
      setCanOrder(false);
      return;
    }

    const start = new Date(selectedProduct.start_date);
    const end = new Date(selectedProduct.end_date);
    const selected = new Date(selectedDate);

    if (
      selected >= start &&
      selected <= end &&
      demandAmount <= selectedProduct.supply_amount
    ) {
      setCanOrder(true);
    } else {
      setCanOrder(false);
    }
  }, [selectedProduct, demandAmount, selectedDate]);

  /* ===============================
     발주 처리 (핵심)
     =============================== */
    async function handleOrder() {
  if (!selectedProduct || !selectedDate || demandAmount <= 0) {
    alert("모든 값을 입력하세요");
    return;
  }

  // 1️⃣ 재고 조회 (가장 먼저)
  const { data: productRow, error: productError } = await supabase
    .from("products")
    .select("id, supply_amount")
    .eq("product_name", selectedProduct.product_name)
    .single();

  if (productError || !productRow) {
    alert("제품 조회 실패");
    return;
  }

  if (productRow.supply_amount < demandAmount) {
    alert("재고 부족");
    return;
  }

  const newAmount = productRow.supply_amount - demandAmount;

  // 2️⃣ orders insert
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
        product_id: productRow.id,
        company_id: "company_test",
        quantity: demandAmount,
        order_date: selectedDate,
      },
    ])
    .select()
    .single();

  if (orderError) {
    alert("발주 실패");
    return;
  }

  // 3️⃣ supplies insert
  const { error: supplyError } = await supabase.from("supplies").insert([
    {
      product_id: productRow.id,
      farmer_id: "farmer_test",
      quantity: demandAmount,
      supply_date: selectedDate,
      text_log: `${selectedProduct.product_name} ${demandAmount}(kg) / ${selectedDate}`,
    },
  ]);

  if (supplyError) {
    alert("공급 기록 저장 실패");
    return;
  }

  // 4️⃣ 재고 UPDATE (마지막)
  const { data: updatedProduct, error: updateError } = await supabase
    .from("products")
    .update({ supply_amount: newAmount })
    .eq("id", productRow.id)
    .select();
  console.log("update result", updatedProduct);
  if (updateError) {
    alert("재고 업데이트 실패");
    return;
  }

  // ✅ 여기까지 왔을 때만 성공
  alert("✅ 발주 완료");

  fetchOrders();
  fetchProducts();
}



  /* ===============================
     피드백 전송
     =============================== */
  async function sendFeedback() {
    if (!message || !selectedOrderId) return;

    const { error } = await supabase.from("feedbacks").insert([
      {
        order_id: selectedOrderId,
        sender_type: "company",
        message,
      },
    ]);

    if (error) {
      alert("피드백 전송 실패");
      return;
    }

    setMessage("");
    fetchFeedbacks(selectedOrderId);
  }
  /* ===============================
     JSX
     =============================== */
  return (
    
    <div className="main-layout company-theme">
      
      <div className="panel-left">
        {/* 수요 입력 */}
        <div className="panel">
          <div className="section-title">📦 발주 품목 선택</div>

          <div className="input-row">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">품목 선택</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.product_name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="수요량(kg)"
              value={demandAmount}
              onChange={(e) => setDemandAmount(Number(e.target.value))}
              min={1}
            />

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            <button
              className="btn btn-add"
              disabled={!canOrder}
              onClick={handleOrder}
            >
              발주
            </button>
          </div>
        </div>

        {/* 발주 기록 */}
        <div className="panel">
          <div className="section-title">🧾 발주 기록</div>

          {orders.length === 0 && (
            <div style={{ fontSize: "13px", color: "#777" }}>
              발주 기록이 없습니다.
            </div>
          )}

          {orders.map((o) => (
            <div
              key={o.id}
              onClick={() => {
                console.log("클릭됨:", o.id); // ← 반드시 찍혀야 함
                setSelectedOrderId(o.id);
                fetchFeedbacks(o.id);
              }}
              style={{
                cursor: "pointer",
                padding: "8px 4px",
                borderBottom: "1px solid #e0e0e0",
                background:
                  selectedOrderId === o.id ? "#e3f2fd" : "transparent",
              }}
            >
              {o.product_name} {o.quantity}(kg) / {o.order_date}
            </div>
          ))}
        </div>


        {/* 피드백 */}
       {selectedOrderId && (
        <div className="panel">
          <div className="section-title">💬 출하 절차 및 피드백</div>

          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {feedbacks.map((f) => (
              <div key={f.id}>
                <b>{f.sender_type === "company" ? "기업" : "농가"}:</b>{" "}
                {f.message}
              </div>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="메시지를 입력하세요"
          />

          <button className="btn btn-add" onClick={sendFeedback}>
            전송
          </button>
        </div>
      )}


      </div>
    </div>
  );
}
