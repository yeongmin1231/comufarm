"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/* ===============================
   타입
=============================== */
type SupplyLog = {
  text_log: string;
};

type AvailableProduct = {
  id: string;
  product_name: string;
  supply_amount: number;
  start_date: string;
  end_date: string;
};

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  order_date: string;
  created_at: string;
};

type FeedbackItem = {
  id: string;
  order_id: string;
  sender_type: "company" | "farmer";
  message: string;
  created_at: string;
};

/* ===============================
   컴포넌트
=============================== */
export default function FarmerPage() {
  /* ---------- 품목 등록 state ---------- */
  const [productName, setProductName] = useState("");
  const [supplyAmount, setSupplyAmount] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  /* ---------- 조회용 state ---------- */
  const [supplies, setSupplies] = useState<SupplyLog[]>([]);
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);

  /* ---------- 발주(기업) 목록 + 피드백 state ---------- */
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  /* ===============================
     공급 가능 품목 등록 (농가)
  =============================== */
  async function handleAddProduct() {
    if (!productName || supplyAmount <= 0 || !startDate || !endDate) {
      alert("모든 값을 입력하세요");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        farmer_id: "farmer_test",
        product_name: productName,
        supply_amount: supplyAmount,
        start_date: startDate,
        end_date: endDate,
      },
    ]);

    if (error) {
      console.error("❌ products insert 실패", error);
      alert("품목 등록 실패");
      return;
    }

    setProductName("");
    setSupplyAmount(0);
    setStartDate("");
    setEndDate("");

    await fetchAvailableProducts();
    alert("📦 공급 가능 품목이 등록되었습니다");
  }

  /* ===============================
     공급 기록 (기업 발주 결과: supplies)
  =============================== */
  async function fetchSupplies() {
    const { data, error } = await supabase
      .from("supplies")
      .select("product_id, quantity, supply_date, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ supplies 조회 실패", error);
      return;
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, product_name");

    if (productsError) {
      console.error("❌ products 조회 실패", productsError);
      return;
    }

    const map = new Map((products ?? []).map((p: any) => [p.id, p.product_name]));

    setSupplies(
      (data ?? []).map((s: any) => ({
        text_log: `${map.get(s.product_id) ?? "알 수 없음"} ${s.quantity}(kg) / ${s.supply_date}`,
      }))
    );
  }

  /* ===============================
     남은 공급 가능 품목
  =============================== */
  async function fetchAvailableProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_name, supply_amount, start_date, end_date")
      .gt("supply_amount", 0)
      .order("product_name");

    if (error) {
      console.error("❌ 공급 가능 품목 조회 실패", error);
      return;
    }
    setAvailableProducts(data ?? []);
  }

  /* ===============================
     기업 발주 목록(orders) 조회
     - 피드백을 "발주 단위"로 보기 위해 필요
  =============================== */
  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("id, quantity, order_date, created_at, products(product_name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ orders 조회 실패", error);
      return;
    }

    const mapped: OrderItem[] = (data ?? []).map((o: any) => ({
      id: o.id,
      product_name: o.products?.product_name ?? "알 수 없음",
      quantity: o.quantity,
      order_date: o.order_date,
      created_at: o.created_at,
    }));

    setOrders(mapped);
  }

  /* ===============================
     피드백 조회/전송
  =============================== */
  async function fetchFeedbacks(orderId: string) {
    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ feedbacks 조회 실패", error);
      return;
    }

    setFeedbacks((data ?? []) as FeedbackItem[]);
  }

  async function sendFeedback() {
    if (!selectedOrderId || !feedbackMessage.trim()) {
      alert("메시지를 입력하세요");
      return;
    }

    const { error } = await supabase.from("feedbacks").insert([
      {
        order_id: selectedOrderId,
        sender_type: "farmer",
        message: feedbackMessage.trim(),
      },
    ]);

    if (error) {
      console.error("❌ feedbacks insert 실패", error);
      alert("피드백 전송 실패");
      return;
    }

    setFeedbackMessage("");
    await fetchFeedbacks(selectedOrderId);
  }

  /* ===============================
     최초 로딩 + 실시간 반영
  =============================== */
  useEffect(() => {
    fetchSupplies();
    fetchAvailableProducts();
    fetchOrders();

    // supplies 바뀌면 공급기록/재고 갱신
    const suppliesChannel = supabase
      .channel("realtime-supplies")
      .on("postgres_changes", { event: "*", schema: "public", table: "supplies" }, () => {
        fetchSupplies();
        fetchAvailableProducts();
      })
      .subscribe();

    // products 바뀌면 공급가능 목록 갱신
    const productsChannel = supabase
      .channel("realtime-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        fetchAvailableProducts();
      })
      .subscribe();

    // orders 바뀌면 발주 목록 갱신
    const ordersChannel = supabase
      .channel("realtime-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    // feedbacks 바뀌면 현재 선택된 발주에 대해서만 갱신
    const feedbacksChannel = supabase
      .channel("realtime-feedbacks")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, () => {
        if (selectedOrderId) fetchFeedbacks(selectedOrderId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(suppliesChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(feedbacksChannel);
    };
    // selectedOrderId는 실시간 갱신 트리거에 쓰이므로 deps에 포함
  }, [selectedOrderId]);

  /* ===============================
     JSX
  =============================== */
  return (
    <div className="main-layout farmer-theme">
      <div className="panel-left">
        {/* 🌱 공급 가능 품목 등록 */}
        <div className="panel">
          <div className="section-title">🌱 공급 가능 품목 등록</div>

          <div className="input-row">
            <input
              type="text"
              placeholder="품목명 (예: 감자)"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />

            <input
              type="number"
              placeholder="공급량(kg)"
              value={supplyAmount}
              onChange={(e) => setSupplyAmount(Number(e.target.value))}
              min={1}
            />

            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

            <button className="btn btn-add" onClick={handleAddProduct}>
              등록
            </button>
          </div>
        </div>

        {/* 📦 공급 가능 품목 */}
        <div className="panel">
          <div className="section-title">📦 공급 가능 품목</div>

          {availableProducts.length === 0 && (
            <div style={{ fontSize: "13px", color: "#777" }}>현재 공급 가능한 품목이 없습니다.</div>
          )}

          {availableProducts.map((p) => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <b>
                {p.product_name} {p.supply_amount}(kg)
              </b>
              <br />
              <span style={{ fontSize: "12px", color: "#666" }}>
                출하 가능: {p.start_date} ~ {p.end_date}
              </span>
            </div>
          ))}
        </div>

        {/* 🚚 공급 기록 */}
        <div className="panel">
          <div className="section-title">🚚 공급 기록</div>

          {supplies.length === 0 && (
            <div style={{ fontSize: "13px", color: "#777" }}>아직 공급 기록이 없습니다.</div>
          )}

          {supplies.map((s, i) => (
            <div key={i}>{s.text_log}</div>
          ))}
        </div>

        {/* 🧾 기업 발주 목록 + 피드백 */}
        <div className="panel">
          <div className="section-title">🧾 기업(출하 절차 공지 및 피드백)</div>

          {orders.length === 0 && (
            <div style={{ fontSize: "13px", color: "#777" }}>아직 발주 기록이 없습니다.</div>
          )}

          {orders.map((o) => (
            <div
              key={o.id}
              onClick={() => {
                setSelectedOrderId(o.id);
                fetchFeedbacks(o.id);
              }}
              style={{
                cursor: "pointer",
                padding: "6px 0",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              {o.product_name} {o.quantity}(kg) / {o.order_date}
              {selectedOrderId === o.id && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "#2e7d32" }}>선택됨</span>
              )}
            </div>
          ))}

          {/* 피드백 패널 */}
          {selectedOrderId && (
            <div style={{ marginTop: 12 }}>
              <div className="section-title">💬 출하공지 및 피드백</div>

              <div style={{ maxHeight: 180, overflowY: "auto", padding: "6px 0" }}>
                {feedbacks.length === 0 && (
                  <div style={{ fontSize: "13px", color: "#777" }}>
                    아직 메시지가 없습니다. (농가/기업이 메시지를 남길 수 있어요)
                  </div>
                )}

                {feedbacks.map((f) => (
                  <div key={f.id} style={{ marginBottom: 6 }}>
                    <b>{f.sender_type === "company" ? "기업" : "농가"}:</b> {f.message}
                    <div style={{ fontSize: 11, color: "#888" }}>{new Date(f.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="기업에게 전달할 메시지를 입력하세요"
                style={{ width: "100%", minHeight: 70, padding: 8 }}
              />

              <button className="btn btn-add" onClick={sendFeedback} style={{ marginTop: 6 }}>
                전송
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
